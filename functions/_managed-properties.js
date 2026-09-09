export const managedProperties = Object.freeze([
  { id:'management-hub', name:'Ascension Manager Hub', type:'hub', repo:'nightowlhoothoot83-create/ascension-automation-hub' },
  { id:'raven-sharp-hub', name:'Raven Sharp Hub', type:'hub', repo:'nightowlhoothoot83-create/Raven-Sharp-Hub' },
  { id:'image-optimiser', name:'Image Optimiser & Upscaler', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Image-Optimiser-Upscaler' },
  { id:'pod-suite', name:'POD Suite', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-POD-Automation' },
  { id:'ad-manager', name:'Ad Manager', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Ad-Manager' },
  { id:'book-creator', name:'Book Creator', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Book-Creator' },
  { id:'content-creator', name:'Content Creator', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Content-Creator' },
  { id:'smart-cleaner', name:'Smart Cleaner', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Smart-AI-Cleaner' },
  { id:'smart-cleaner-web', name:'Smart Cleaner Web', type:'saas', repo:'nightowlhoothoot83-create/Raven-Sharp-Smart-Cleaner-Web' },
  { id:'mycalctools', name:'MyCalcTools', type:'adsense', repo:'nightowlhoothoot83-create/Mycalctools', baselineApproved:true },
  { id:'mycalendartools', name:'MyCalendarTools', type:'adsense', repo:'nightowlhoothoot83-create/Mycalendartools', baselineApproved:true },
  { id:'wheelnamepicker', name:'Wheel Name Picker', type:'adsense', repo:'nightowlhoothoot83-create/Wheelnamepicker', baselineApproved:true },
  { id:'mystical-moments', name:'Mystical Moments', type:'website', repo:'nightowlhoothoot83-create/Mystical-Moments' },
  { id:'natures-sacred-synergy', name:"Nature's Sacred Synergy", type:'website', repo:'nightowlhoothoot83-create/Natures-Sacred-Synergy' },
  { id:'natures-synergy-services', name:"Nature's Synergy Services", type:'website', repo:'nightowlhoothoot83-create/Natures-Synergy-Services' },
  { id:'store-ops', name:'Raven Sharp Store Ops', type:'automation', repo:'nightowlhoothoot83-create/Raven-Sharp-Store-Ops' },
  { id:'qa-agent', name:'Raven Sharp QA Agent', type:'automation', repo:'nightowlhoothoot83-create/Raven-Sharp-QA-Agent' },
  { id:'adg-monitor', name:'ADG Monitor', type:'monitor', repo:'nightowlhoothoot83-create/ADG-MONITOR-V4' }
]);

export const managedPropertyIds = new Set(managedProperties.map((item)=>item.id));
