(function () {
  var intro = document.getElementById('acaciaIntro');
  if (!intro) return;

  // Día del Niño en México: 25-30 de abril, hora MX, recurrente cada año
  var mxNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' })
  );
  var inWindow = (mxNow.getMonth() === 3 && mxNow.getDate() >= 25 && mxNow.getDate() <= 30);

  var alreadyShown = false;
  try { alreadyShown = sessionStorage.getItem('acacia_intro_shown') === '1'; } catch (e) {}

  if (!inWindow || alreadyShown) { intro.remove(); return; }

  try { sessionStorage.setItem('acacia_intro_shown', '1'); } catch (e) {}

  // The overlay ships with the `hidden` attribute in the HTML so it can never
  // cover the page outside the date window (or if this script fails to load);
  // it is only revealed here, once we have decided to play it.
  intro.removeAttribute('hidden');

  setTimeout(function () { intro.remove(); }, 10000);

  intro.addEventListener('click', function () {
    intro.style.transition = 'opacity 0.4s';
    intro.style.opacity = '0';
    setTimeout(function () { intro.remove(); }, 450);
  });
})();
