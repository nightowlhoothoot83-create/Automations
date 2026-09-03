import { readdir, stat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const IMAGE=new Set(['.jpg','.jpeg','.png','.webp','.tif','.tiff','.gif','.svg']);
const DESIGN=new Set(['.psd','.ai','.eps','.afdesign','.xcf','.kra']);
const BOOK=new Set(['.epub','.indd','.mobi','.docx','.pdf']);
const FONT=new Set(['.ttf','.otf','.woff','.woff2']);
const VIDEO=new Set(['.mp4','.mov','.avi','.mkv','.webm']);

export function classifyAsset(file) {
  const ext=path.extname(file).toLowerCase(), lower=file.toLowerCase();
  if(FONT.has(ext))return 'FONTS';
  if(DESIGN.has(ext))return 'WORKING FILES';
  if(BOOK.has(ext)||/book|cover|manuscript|publishing/.test(lower))return 'BOOK / PUBLISHING';
  if(/logo|brand|identity/.test(lower))return 'BRAND ASSETS';
  if(/mockup|mock-up/.test(lower))return 'MOCKUPS';
  if(IMAGE.has(ext)&&/pod|shirt|merch|printify|printful/.test(lower))return 'POD READY';
  if(IMAGE.has(ext)&&/photo|photography|raw|lightroom/.test(lower))return 'PHOTOGRAPHY';
  if(IMAGE.has(ext)&&/printable|download|template/.test(lower))return 'DIGITAL DOWNLOAD READY';
  if(IMAGE.has(ext)||VIDEO.has(ext))return 'NEEDS REVIEW';
  return 'MISCELLANEOUS';
}

async function hashFile(file){const data=await readFile(file);return createHash('sha256').update(data).digest('hex');}
async function walk(root,current=root,items=[]){for(const entry of await readdir(current,{withFileTypes:true})){const absolute=path.join(current,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory())await walk(root,absolute,items);else if(entry.isFile()){const info=await stat(absolute);items.push({absolutePath:absolute,relativePath:path.relative(root,absolute),bytes:info.size,modifiedAt:info.mtime.toISOString(),extension:path.extname(entry.name).toLowerCase(),category:classifyAsset(absolute),sha256:await hashFile(absolute)});}}return items;}

export async function inventoryAssets(root){const absolute=path.resolve(root);const info=await stat(absolute);if(!info.isDirectory())throw new Error('Inventory root must be a directory');const files=await walk(absolute);const groups=new Map();for(const item of files){const key=`${item.sha256}:${item.bytes}`;groups.set(key,[...(groups.get(key)||[]),item.relativePath]);}const exactDuplicates=[...groups.entries()].filter(([,paths])=>paths.length>1).map(([key,paths])=>({sha256:key.split(':')[0],bytes:Number(key.split(':')[1]),paths}));return {schemaVersion:'1.0.0',automationId:'automation-3',mode:'read-only',generatedAt:new Date().toISOString(),root:absolute,summary:{files:files.length,bytes:files.reduce((n,x)=>n+x.bytes,0),exactDuplicateGroups:exactDuplicates.length},files,exactDuplicates,possibleDuplicates:[],proposedActions:exactDuplicates.map((group,index)=>({id:`exact-duplicate-${index+1}`,action:'review-duplicate-group',status:'owner-review-required',paths:group.paths,sha256:group.sha256,note:'No file was moved, renamed, overwritten, or deleted.'}))};}
