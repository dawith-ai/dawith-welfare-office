// The lightweight desktop runtime stops its local server once no window has
// checked in for a few minutes, so every desktop page reports that it is open.
if (new URLSearchParams(window.location.search).get('desktop') === '1') sessionStorage.setItem('dawith-desktop', '1');
if (sessionStorage.getItem('dawith-desktop') === '1') {
  const beat = () => fetch('/api/desktop/heartbeat', { method: 'POST' }).catch(() => {});
  beat();
  setInterval(beat, 20000);
}
