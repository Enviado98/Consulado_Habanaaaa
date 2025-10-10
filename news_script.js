function getNews(){return JSON.parse(localStorage.getItem('news')||'[]')}
function saveNews(n){localStorage.setItem('news',JSON.stringify(n));render()}
function render(){const list=document.getElementById('newsList');const items=getNews();list.innerHTML='';if(!items.length){list.innerHTML='<li>No hay noticias registradas.</li>';return;}items.reverse().forEach((n,i)=>{const li=document.createElement('li');li.innerHTML=`<h4>${n.titulo}</h4><p>${n.cuerpo}</p><small>${n.fecha}</small>`;list.appendChild(li)})}
document.getElementById('addNews').addEventListener('click',()=>{const t=prompt('Título de la noticia:');if(!t)return;const c=prompt('Contenido:')||'';const n=getNews();n.push({titulo:t,cuerpo:c,fecha:new Date().toLocaleString()});saveNews(n)});
document.getElementById('clearNews').addEventListener('click',()=>{if(confirm('¿Borrar todas las noticias?')){localStorage.removeItem('news');render()}});
render();
