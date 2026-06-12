const $ = (id) => document.getElementById(id);

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function renderCards(el, topics) {
  el.innerHTML = topics.map(t => `
    <div class="card">
      <span class="score">${Number(t.score || 0).toFixed(1)}</span>
      <h3>${t.name}</h3>
      <p>${t.summary || t.why_follow || ''}</p>
      <p><span class="badge">${t.priority || 'trend'}</span>${(t.labels || []).slice(0,3).map(x=>`<span class="badge">${x}</span>`).join('')}</p>
      <button onclick="deepDive('${t.id}')">Deep dive</button>
    </div>`).join('');
}

async function load() {
  const country = encodeURIComponent($('country').value || 'Italy');
  const city = encodeURIComponent($('city').value || 'Rome');
  const goal = encodeURIComponent($('goal').value || 'career');
  const rec = await fetchJSON(`/api/v1/recommendations?country=${country}&city=${city}&goal=${goal}&profile=developer&limit=10&depth=explain`);
  renderCards($('recommendations'), rec.recommendations);
  const global = await fetchJSON('/api/v1/trends/global?limit=10');
  renderCards($('global'), global.topics);
}

async function deepDive(topic) {
  const country = encodeURIComponent($('country').value || 'Italy');
  const city = encodeURIComponent($('city').value || 'Rome');
  const data = await fetchJSON(`/api/v1/topics/${topic}/deep-dive?country=${country}&city=${city}`);
  $('deepdive').textContent = JSON.stringify(data, null, 2);
}

$('load').addEventListener('click', load);
$('geo').addEventListener('click', () => {
  navigator.geolocation?.getCurrentPosition(() => {
    alert('Browser geolocation is available. Reverse geocoding should be connected in production.');
  });
});
load();
