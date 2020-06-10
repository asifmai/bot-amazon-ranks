const pupHelper = require('./puppeteerhelper');
const fs = require('fs');
const moment = require('moment');
const path = require('path');
const {urls} = require('./keys');
let browser;
const results = []
const filePath = path.join(__dirname, 'results', `results-${moment().format('DD-MM-YYYY HH-mm')}.json`);
const dbPath = path.join(__dirname, 'results', 'db.json');

const run = () => new Promise(async (resolve, reject) => {
  try {
    console.log('Stated Scraping...');
    browser = await pupHelper.launchBrowser();
    
    for (let i = 0; i < urls.length; i++) {
      await scrapeUrl(i);
    }

    await writeToDb();
    
    await browser.close();
    console.log('Finished Scraping...');
    resolve(true);
  } catch (error) {
    if (browser) await browser.close();
    console.log('run Error: ', error);
    reject(error);
  }
});

const scrapeUrl = (urlIdx) => new Promise(async (resolve, reject) => {
  let page;
  try {
    const result = {timestamp: moment().format()};
    console.log(`${urlIdx+1}/${urls.length} - Scraping from url ${urls[urlIdx]}`);
    page = await pupHelper.launchPage(browser);
    await page.goto(urls[urlIdx], {timeout: 0, waitUntil: 'load'});
    await page.waitForSelector('h1#title');
    const haveSalesRank = await page.$('li#SalesRank');
    if (haveSalesRank) {
      await page.waitForSelector('li#SalesRank', page);
      let salesRank = await pupHelper.getTxt('li#SalesRank', page);
      salesRank = salesRank.split('\n');
      let resKey = salesRank[0].match(/^.*(?=\:)/gi)[0].trim();
      let resVal = salesRank[0].match(/(?<=\: ).*?(?=\s)/gi)[0].trim().replace(/[#,]/gi, '').trim();
      result[resKey] = resVal;
      const salesRanksSub = await page.$$('#SalesRank > ul.zg_hrsr > .zg_hrsr_item');
      for (let i = 0; i < salesRanksSub.length; i++) {
        resKey = await pupHelper.getTxt('.zg_hrsr_ladder > a', salesRanksSub[i])
        resKey = resKey.replace(/\(kindle store\)/gi, '').trim();
        resVal = await pupHelper.getTxt('.zg_hrsr_rank', salesRanksSub[i])
        resVal = resVal.replace(/[#,]/gi, '').trim();
        result[resKey] = resVal;
      }
    } else {
      console.log('No Sales Rank Found. Skipping the link...');
      await page.close();
      return resolve(false);
    }
    result.marketplace = urls[urlIdx].match(/(?<=www\.).*?(?=\/)/gi)[0];
    result.asin = urls[urlIdx].replace(/\/$/gi, '').split('/').pop();
    results.push(result);

    await page.close();
    resolve(true);
  } catch (error) {
    if (page) await page.close();
    console.log(`scrapeUrl [${urlIdx}] Error: ${error}`);
    resolve(error);
  }
})

const writeToDb = () => new Promise(async (resolve, reject) => {
  try {
    let data = [];
    const dbFileExists = fs.existsSync(dbPath)
    if (dbFileExists) data = JSON.parse(fs.readFileSync(dbPath));

    data.push(...results);
    fs.writeFileSync(dbPath, JSON.stringify(data));

    resolve(true);
  } catch (error) {
    console.log('writeToDb Error: ', error);
    reject(error);
  }
});

run();
