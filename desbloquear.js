'use strict';
// El navegador descifra el contenido; la contraseña no se transmite ni se guarda.
const form=document.getElementById('acceso'),field=document.getElementById('clave'),status=document.getElementById('mensaje'),button=form.querySelector('button');
document.getElementById('mostrar').addEventListener('change',e=>field.type=e.target.checked?'text':'password');
function decode64(value){const raw=atob(value);return Uint8Array.from(raw,c=>c.charCodeAt(0));}
form.addEventListener('submit',async e=>{
 e.preventDefault();button.disabled=true;status.textContent='Abriendo…';
 try{
  if(!crypto.subtle)throw Error('browser');
  const response=await fetch('contenido.bin',{cache:'no-store'});if(!response.ok)throw Error('network');
  const bytes=new Uint8Array(await response.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,8))!=='BITAC02\n')throw Error('format');
  const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8);
  const header=JSON.parse(new TextDecoder().decode(bytes.slice(12,12+size)));
  const aad=new TextEncoder().encode('avances-del-juego:v2');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(field.value),'PBKDF2',false,['deriveKey']);
  let contentKey;
  for(const slot of header.slots){try{
   const wrappingKey=await crypto.subtle.deriveKey({name:'PBKDF2',salt:decode64(slot.salt),iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
   const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(slot.iv),additionalData:aad,tagLength:128},wrappingKey,decode64(slot.key));
   contentKey=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);break;
  }catch{}}
  if(!contentKey)throw Error('password');
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(header.iv),additionalData:aad,tagLength:128},contentKey,bytes.slice(12+size));
  const payload=JSON.parse(new TextDecoder().decode(decrypted));let html=payload.html,css=payload.css;
  for(const [name,asset] of Object.entries(payload.assets)){
   const url=URL.createObjectURL(new Blob([decode64(asset.data)],{type:asset.mime}));
   html=html.split(name).join(url);css=css.split(name).join(url);
  }
  html=html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g,'').replace(/<link\b[^>]*rel="preload"[^>]*>/g,'').replace('</head>','<style>'+css+'</style></head>');
  field.value='';document.open();document.write(html);document.close();
 }catch(error){
  status.textContent=error.message==='password'?'Contraseña incorrecta.':error.message==='browser'?'Abre el enlace en un navegador actualizado.':'No se pudo abrir la página. Revisa tu conexión e inténtalo de nuevo.';
  field.value='';field.focus();button.disabled=false;
 }
});
