// The API returns newest first. Keep one current status per SKU.
export function currentOlistHistory(history=[]){
 const seen=new Set(),result=[];
 for(const entry of history){
  for(let i=0;i<(entry.skus||[]).length;i++){
   const sku=entry.skus[i],key=String(sku).trim().toUpperCase();
   if(seen.has(key))continue;
   seen.add(key);
   result.push({...entry,key,skus:[sku],productIds:entry.productIds?.[i]?[entry.productIds[i]]:[]});
  }
 }
 return result;
}
