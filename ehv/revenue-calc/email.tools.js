/* UseBouncer email validation loader */
(function () {
  window.bouncerConfig = {
    apikey: '3aD3H5wT7t8Wf5hguWvE9GfR2i5eYWzEwbetSMdU',
    feedbackOverlayMessage: 'Email: Incorrect',
  };

  var s = document.createElement('script');
  s.type = 'text/javascript';
  s.src = 'https://app.usebouncer.com/bouncer-script/bouncer-script-beta.js';
  document.head.appendChild(s);
})();
