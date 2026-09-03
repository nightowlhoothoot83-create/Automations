import path from 'node:path';

const PRODUCT_MAP={
  'POD READY':['multi-provider POD product'],
  'DIGITAL DOWNLOAD READY':['digital download','printable'],
  'PHOTOGRAPHY':['photography print','fine-art print','digital licence'],
  'BOOK / PUBLISHING':['book or publishing asset'],
  'BRAND ASSETS':['brand asset pack']
};
const SUPPORTED=new Set(['.jpg','.jpeg','.png','.webp','.tif','.tiff','.svg','.pdf','.epub']);
function words(file){return path.basename(file,path.extname(file)).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();}
function title(file){return words(file).replace(/\b\w/g,(x)=>x.toUpperCase());}

export function prepareProductPackage(asset){
  const products=PRODUCT_MAP[asset.category]||[];const issues=[];
  if(!SUPPORTED.has(asset.extension))issues.push('format requires manual product-path review');
  if(!products.length)issues.push('no commercial product category is safely inferred');
  if(!(asset.bytes>0))issues.push('empty file');
  const status=issues.length?'BLOCKED':asset.category==='POD READY'||asset.category==='PHOTOGRAPHY'?'NEEDS WORK':'READY';
  return {assetRef:{relativePath:asset.relativePath,sha256:asset.sha256,bytes:asset.bytes,category:asset.category},status,viableProductTypes:products,masterPolicy:'preserve-original',requiredWork:status==='NEEDS WORK'?['verify pixel dimensions and print-area compatibility','select provider or marketplace explicitly','create derivatives without overwriting master']:issues,metadata:{title:title(asset.relativePath),description:`${title(asset.relativePath)} — prepared from a preserved ${asset.category.toLowerCase()} source asset.`,tags:words(asset.relativePath).toLowerCase().split(' ').filter((x)=>x.length>2),marketplaceFields:{}},publishing:{allowed:false,reason:'Owner approval, provider selection, current specifications, and account evidence are required.'}};
}

export function buildProductQueue(inventory){if(inventory?.schemaVersion!=='1.0.0'||inventory.automationId!=='automation-3'||inventory.mode!=='read-only'||!Array.isArray(inventory.files))throw new Error('Unsupported Automation 3 inventory');const items=inventory.files.map(prepareProductPackage);return {schemaVersion:'1.0.0',automationId:'automation-4',mode:'prepare-only',generatedAt:new Date().toISOString(),source:{automationId:'automation-3',generatedAt:inventory.generatedAt,root:inventory.root},summary:{READY:items.filter(x=>x.status==='READY').length,'NEEDS WORK':items.filter(x=>x.status==='NEEDS WORK').length,BLOCKED:items.filter(x=>x.status==='BLOCKED').length},items,providerActions:[],published:false};}
