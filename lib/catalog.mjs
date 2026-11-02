export const MIN_PRODUCT_SEQUENCE = 380;
export const colors=[
["01","Preto"],["02","Branco"],["03","Azul escuro"],["04","Azul claro"],["05","Marrom"],["06","Roxo"],["07","Verde escuro"],["08","Lilás"],["09","Off"],["10","Laranja"],["11","Amarelo"],["12","Bege"],["13","Rosa"],["14","Vermelho"],["15","Cinza"],["16","Caramelo"],["17","Caqui"],["18","Azul estonado claro"],["19","Azul estonado escuro"],["20","Verde claro"],["21","Terracota"],["22","Prata"],["23","Dourado"],["24","Estampado"],["25","Único"],["26","Preto estonado"]
];
export const sizes=[["01","PP"],["02","P"],["03","M"],["04","G"],["05","GG"],["06","G1 / XG"],["07","Único"],["08","XGG"],...["12","14","16","18","20","34","36","38","40","42","44","46","48","50","52","54","56"].map(x=>[x,x])];
export const genders=[["F","Feminino"],["M","Masculino"],["U","Unissex"]];
export const normalize=x=>String(x??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toUpperCase();
export function lookup(table,value){
 let n=normalize(value);
 if(table===sizes && ["G1","XG"].includes(n))n="G1 / XG";
 if(table===colors && n==="AZUL CLARO ESTONADO")n="AZUL ESTONADO CLARO";
 if(table===colors && n==="AZUL ESCURO ESTONADO")n="AZUL ESTONADO ESCURO";
 return table.find(([code,name])=>normalize(code)===n||normalize(name)===n);
}
export function prefixFor(name){
 const p=normalize(name).replace(/[^A-Z]/g,"").slice(0,3);
 if(p.length!==3)throw new Error("Informe um produto com pelo menos três letras.");
 return p;
}
export function makeSku(prefix,gender,seq,size,color){
 if(!/^[A-Z]{3}$/.test(prefix)||!genders.some(x=>x[0]===gender)||!Number.isInteger(seq)||seq<1||seq>9999||!sizes.some(x=>x[0]===size)||!colors.some(x=>x[0]===color))throw new Error("Dados inválidos para gerar SKU.");
 return prefix+gender+String(seq).padStart(4,"0")+size+color;
}
export function cents(value){
 if(value===null||value===undefined||value==="")return null;
 if(typeof value==="number"){if(!Number.isFinite(value)||value<0)throw new Error("Preço inválido.");return Math.round(value*100);}
 let v=String(value).replace(/R\$|\s/g,"");
 if(v.includes(","))v=v.replace(/\./g,"").replace(",",".");
 if(!/^\d+(\.\d{1,2})?$/.test(v))throw new Error("Informe um preço válido, como 65,90.");
 return Math.round(Number(v)*100);
}
export const suggested=cost=>Math.round(cost*2.5);
export function inspectRows(rows){
 const counts=new Map();for(const r of rows)counts.set(r.sku,(counts.get(r.sku)||0)+1);
 return rows.map(r=>{
 const issues=[];
 if(counts.get(r.sku)>1)issues.push("SKU repetido");
 const match=String(r.sku).match(/^(.*?)(\d{8})$/);
 if(!match||/\d/.test(match[1]))issues.push("Formato antigo a revisar");
 if(match){
 const [,letters,digits]=match;const s=lookup(sizes,r.size),c=lookup(colors,r.color);
 if(s&&digits.slice(4,6)!==s[0])issues.push("Tamanho diverge do SKU");
 if(c&&digits.slice(6)!==c[0])issues.push("Cor diverge do SKU");
 if(!/[FMU]$/.test(letters))issues.push("Gênero não identificado");
 }
 if(!lookup(sizes,r.size))issues.push("Tamanho fora da tabela");
 if(!lookup(colors,r.color))issues.push("Cor fora da tabela");
 if(r.price===null)issues.push("Sem preço de venda");
 return {...r,issues};
 });
}

// Existing codes may have a longer product abbreviation. Preserve it verbatim.
export function variationBase(sku){
 const match=/^([A-Z]+)([0-9]{4})([0-9]{2})([0-9]{2})$/.exec(String(sku||""));
 return match?{initial:match[1]+match[2],seq:Number(match[2])}:null;
}
export function variationSku(sku,size,color){
 const base=variationBase(sku);
 if(!base||!sizes.some(x=>x[0]===size)||!colors.some(x=>x[0]===color))throw new Error("Este SKU não permite identificar o início do modelo. Revise o código antes de adicionar uma variação.");
 return base.initial+size+color;
}

export const MAX_PRODUCT_NAME_LENGTH=160;
export function productName(value){
 const name=String(value??"").trim();
 if(name.length>MAX_PRODUCT_NAME_LENGTH)throw new Error("O nome do produto ultrapassa "+MAX_PRODUCT_NAME_LENGTH+" caracteres. Reduza o texto antes de salvar.");
 return name;
}
