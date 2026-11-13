// Upper altitude inclusive (feet MSL), target knots IAS. Synthetic training only.
const defaults=[{ceiling:1999,ias:136},{ceiling:2999,ias:160},{ceiling:3999,ias:200},{ceiling:8100,ias:210},{ceiling:11099,ias:230},{ceiling:15000,ias:250},{ceiling:60000,ias:270}];
function normalize(profile=defaults){if(!Array.isArray(profile)||!profile.length||profile.length>20)throw Error('Use 1–20 altitude bands.');let previous=-1;const result=profile.map(r=>{const ceiling=Number(r.ceiling),ias=Number(r.ias);if(r.ceiling===''||r.ias===''||!Number.isInteger(ceiling)||ceiling<=previous||ceiling>60000||!Number.isInteger(ias)||ias<50||ias>400)throw Error('Bands must have increasing whole-foot ceilings and 50–400 knots IAS.');previous=ceiling;return {ceiling,ias};});if(previous!==60000)throw Error('The last altitude ceiling must be 60000 feet.');return result;}
function target(profile,altitude){return (profile||defaults).find(r=>altitude<=r.ceiling)?.ias??(profile||defaults).at(-1).ias;}
const groups=['light','medium','heavy','prop','highProp','jet'];
function normalizeGroup(group,profile){
 if(!groups.includes(group))throw Error('Unknown aircraft speed profile.');
 return profile===null&&group!=='jet'?null:normalize(profile===null?undefined:profile);
}
function normalizeGroups(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid aircraft speed profiles.');
 return Object.fromEntries(Object.entries(value).flatMap(([key,rows])=>{
  const profile=normalizeGroup(key,rows);
  return profile?[[key,profile]]:[];
 }));
}
function select(a,profiles={},isJet=false){
 const wake=({L:'light',M:'medium',H:'heavy',J:'heavy'})[a.wake];
 if(wake&&profiles[wake])return wake;
 if(isJet)return 'jet';
 const high=/^(DH8|AT[47]|SF34|SB20|B190|BE[1239]|PC12|P180|TBM|C208|C4[024]|DHC[567]|L410|F[25]0|JS[34]|SW[34])/.test(a.type);
 return high&&profiles.highProp?'highProp':(high||a.category==='prop'||/^(C1[2578]|C20[567]|PA|SR2|DA[246]|P28|BE|M20|DR4|RV)/.test(a.type))&&profiles.prop?'prop':null;
}
module.exports={defaults,normalize,target,normalizeGroup,normalizeGroups,select};
