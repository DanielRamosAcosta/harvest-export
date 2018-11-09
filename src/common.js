const fs = require('fs')

const COOKIES_DEFAULT_PATH = "./cookies.json";

function loginNeeded(page) {
  return page.$("#email").then(element => element !== null);
}

async function loadCookies(page, cookiesPath = COOKIES_DEFAULT_PATH) {
  if (fs.existsSync(cookiesPath)) {
    const cookiesFile = fs.readFileSync(cookiesPath, "utf8");
    const cookies = JSON.parse(cookiesFile);
    await page.setCookie(...cookies);
  }
}

async function saveCookies(page, cookiesPath = COOKIES_DEFAULT_PATH) {
  const cookiesObject = await page.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(cookiesObject, null, 2));
}

module.exports = {
  loginNeeded,
  loadCookies,
  saveCookies
}