document.getElementById('editMode').addEventListener('click',()=>{
  const panel=document.getElementById('adminPanel');
  panel.classList.toggle('hidden');
});
document.getElementById('saveChanges').addEventListener('click',()=>{
  const name=document.getElementById('siteName').value;
  const desc=document.getElementById('siteDesc').value;
  localStorage.setItem('siteName',name);
  localStorage.setItem('siteDesc',desc);
  alert('Cambios guardados localmente.');
});
document.getElementById('resetChanges').addEventListener('click',()=>{
  localStorage.clear();location.reload();
});
window.addEventListener('load',()=>{
  const name=localStorage.getItem('siteName');const desc=localStorage.getItem('siteDesc');
  if(name)document.querySelector('.logo-area h1').textContent=name;
  if(desc)document.querySelector('.hero p').textContent=desc;
});
