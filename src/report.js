const puppeteer = require("puppeteer");
const inquirer = require('inquirer')
const fs = require('fs')
const { loadCookies, loginNeeded, saveCookies } = require('./common')

const HARVEST_BASE_URL = 'https://leanmind1.harvestapp.com'

function textOf(page, selector) {
  return page.evaluate((selector) => document.querySelector(selector).textContent, selector)
}

function textsOf(page, selector) {
  return page.evaluate((selector) => [...document.querySelectorAll(selector)].map(e => e.textContent), selector)
}

async function timesheetLoad(page) {
  await page.waitForSelector('.js-navigation-triggered .loading-week')
  await page.waitForSelector('.js-navigation-triggered .loading-week', { hidden: true })
}

async function login(page) {
  const { email, password } = await inquirer.prompt([
    {name: 'email'},
    {name: 'password', type: 'password'},
  ])

  await page.type("#email", email);
  await page.type("#password", password);
  await page.click('button[type="submit"]');

  await Promise.race([
    page.waitForSelector('.alert')
      .then(() => textOf(page, '.alert'))
      .then(errorMessage => Promise.reject(new Error(errorMessage))),
    page.waitForSelector('#weekly-timesheets-wrapper')
  ])
}

async function goToNextWeek(page) {
  await page.click('.js-harvest-current-view [title="Next Week"]')
}

function getDateRanges (page) {
  return textOf(page, '.js-harvest-current-view h1')
    .then(str => str.match(re))
    .then(([fullMatch, startDay, startMonth, startYear, endDay, endMonth, endYear]) => ({
      startDate: new Date(`${startDay} ${startMonth || endMonth} ${startYear || endYear}`),
      endDate: new Date(`${endDay} ${endMonth} ${endYear}`),
    }))
}

const re = /(\d\d) ?(\w\w\w)? ?(\d\d\d\d)? – (\d\d) (\w\w\w) (\d\d\d\d)/

function hoursToDecimal(hoursFormatted) {
  const matches = hoursFormatted.match(/(\d\d?):(\d\d)/)
  if (!matches) {
    return 0
  }
  const [, hours, minutes] = matches
  return (Number(hours, 10) + (Number(minutes, 10) / 60))
}

function getDaysHours(page) {
  return textsOf(page, '.js-harvest-current-view tfoot .day')
    .then(days => days.map(hoursToDecimal))
}

function formatDate(date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

function formatWeek (week) {
  return {
    startDate: formatDate(week.startDate),
    endDate: formatDate(week.endDate),
    hours: week.hours.map(hour => hour.toString().replace('.', ','))
  }
}

function weekToColumns(week) {
  return [week.startDate, week.endDate, ...week.hours]
}

async function exportTimesheet(page, month) {
  await page.goto(`${HARVEST_BASE_URL}/time/week/2018/${month}/01`);
  const weeks = []

  for (let i = 0; i < 5; i++) {
    const dateRanges = await getDateRanges(page)
    const hours = await getDaysHours(page)

    weeks.push({ ...dateRanges, hours })

    await goToNextWeek(page)
    await timesheetLoad(page)  
  }

  const COLUMN_SEPARATOR = '\t'
  const ROW_SEPARATOR = '\n'

  const csvHeader = [
    'startDate',
    'endDate',
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
    'domingo',
  ].join(COLUMN_SEPARATOR)

  console.log(weeks)

  const csvBody = weeks
    .map(formatWeek)
    .map(weekToColumns)
    .map(columns => columns.join(COLUMN_SEPARATOR))
    .join(ROW_SEPARATOR)

  const csv = csvHeader + ROW_SEPARATOR + csvBody + ROW_SEPARATOR

  fs.writeFileSync('./horas.csv', csv)
}

async function exportFullMonthHours (page, month) {
  await page.goto(`${HARVEST_BASE_URL}/reports?from=2018-${month}-01&kind=month&till=2018-${month}-30`)
  await page.waitForSelector('#billable-percent-circle')
  await page.screenshot({
    path: './proof.png',
    clip: {
      x: 0,
      y: 120,
      width: 500,
      height: 270
    }
  })
}

async function main () {
  const browser = await puppeteer.launch({
    headless: false
  });

  const page = await browser.newPage();

  await loadCookies(page);
  await page.goto(HARVEST_BASE_URL);
  if (await loginNeeded(page)) await login(page)
  await saveCookies(page);

  const MONTH = 11

  await exportTimesheet(page, MONTH)
  await exportFullMonthHours(page, MONTH)
  
  await browser.close();
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })