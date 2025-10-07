let installPrompt = null;
const installButton = document.querySelector("#install");

window.addEventListener("beforeinstallprompt", (event) => {
  console.log('wffwfw')
  event.preventDefault();
  installPrompt = event;
  console.log('wffwfw')

});

installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    return;
  }
  const result = await installPrompt.prompt();
  console.log(`Install prompt was: ${result.outcome}`);
  disableInAppInstallPrompt();
  console.log('>>>>>>>>>0>>>>')
});

function disableInAppInstallPrompt() {
  installPrompt = null;
  installButton.setAttribute("hidden", "");
  console.log('<<<<<<<<<<<<wffwfw>>>>>>>>>>>>')
}
