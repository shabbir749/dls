export const $=(s,r=document)=>r.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=n=>'৳'+Number(n||0).toLocaleString('en-IN');
export const icons=()=>window.lucide&&window.lucide.createIcons();
export const skeleton=(n=3)=>`<div class="space-y-3 p-4">${Array(n).fill('<div class="h-28 animate-pulse rounded-2xl bg-slate-800/60"></div>').join('')}</div>`;
export function toast(msg,type='ok'){
  const el=document.createElement('div');
  el.className=`fixed left-1/2 bottom-24 z-[70] -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-semibold shadow-xl backdrop-blur-md ${type==='err'?'bg-red-500/90 text-white':'bg-neon/95 text-ink'}`;
  el.textContent=msg;document.body.append(el);setTimeout(()=>el.remove(),3000);
}
export function modal(html){
  const el=document.createElement('div');
  el.className='fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center';
  el.innerHTML=`<div class="glass max-h-[88vh] w-full translate-y-6 overflow-y-auto rounded-t-3xl p-5 pb-8 opacity-0 transition duration-200 sm:max-w-md sm:rounded-3xl">${html}</div>`;
  document.body.append(el);
  requestAnimationFrame(()=>el.firstElementChild.classList.remove('translate-y-6','opacity-0'));
  const close=()=>el.remove();el.onclick=e=>{if(e.target===el)close()};icons();
  return{el,close,$:s=>el.querySelector(s)};
}
