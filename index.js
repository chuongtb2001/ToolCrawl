const puppeteer = require('puppeteer');
const fs = require('fs');
const Papa = require('papaparse');
const proxyChain = require('proxy-chain');

(async () => {
  const proxies = [
    "http://171.251.245.38:10003",
    "http://27.72.244.228:8080",
    "http://171.160.209.113:19132",
    "http://G98SWs:Un98Y4@45.145.57.235:12790",
    "http://ABUxEp:sUWc0m@181.177.87.231:9469",
  ];

  let proxyUrlIndex = 0

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--disable-web-security"],
  });

  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const oldProxyUrl = proxies[proxyUrlIndex];
    const newProxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl);
    request.continue({
      proxy: newProxyUrl,
    });
  });
  let pageNumber = 1;
  let productsJson = [];
  // get products in page < 1
  while (pageNumber < 100) {
    const productInfo = {
      productName: "",
      productPrice: "",
      productPriceSale: "",
      productImgs: [],
    };
    let mainPage
    while (true) {
      try {
        mainPage = await page.goto(
          `https://www.fanatics.com/nba/los-angeles-lakers/men/o-2447+t-69584146+ga-56+z-820-817603699?pageSize=72&pageNumber=${pageNumber}&sortOption=TopSellers`,
          { timeout: 300000 }
        );
        console.log(mainPage.status());
        break
      } catch (error) {
        console.log(error);
        //handle
        page.removeAllListeners("request");
        proxyUrlIndex = proxyUrlIndex >= proxies.length - 1? 0 : proxyUrlIndex + 1
        await page.setRequestInterception(true);
        page.on("request", async (request) => {
          const oldProxyUrl = proxies[proxyUrlIndex];
          const newProxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl);
          request.continue({
            proxy: newProxyUrl,
          });
        });
      }
    }
    const title = await page.title()
    console.log(title);
    const productHrefList = await page.$$eval(
      ".product-image-container a",
      (elements) => {
        return elements.map((el) => el.href);
      }
    );
        console.log(productHrefList.length);

    for (const productHref of productHrefList) {
      //get page
      try {
        const pageProduct = await page.goto(productHref, { timeout: 300000 });
        if (pageProduct.status() !== 200) {
          continue;
        }
      } catch (error) {
        console.log(error);
        continue;
      }
      //get information about products

      //get product name
      try {
        productInfo.productName = await page.$eval(
          ".product-title-container h1",
          (el) => el.textContent
        );
      } catch (error) {
        productInfo.productName = "";
      }
      //get product origin price
      try {
        productInfo.productPrice = await page.$eval(
          ".pdp-price .price:not(.primary) .sr-only",
          (el) => el.textContent
        );
      } catch (error) {
        productInfo.productPrice = "";
      }
      //get product sale price
      try {
        productInfo.productPriceSale = await page.$eval(
          ".pdp-price .price.primary .sr-only",
          (el) => el.textContent
        );
      } catch (error) {
        productInfo.productPriceSale = "";
      }
      //get product images
      try {
        productInfo.productImgs = await page.$$eval(
          ".thumbnail-images img",
          (elements) => elements.map((el) => el.src)
        );
      } catch (error) {
        productInfo.productImgs = [];
      }

      productsJson = [productInfo];
      console.log("Crawl done: " + productInfo.productName);
      //import new product to csv
      const csv = Papa.unparse(productsJson);
      fs.appendFile("output.csv", csv, (err) => {
        if (err) throw err;
        console.log(`${productInfo.productName} is saved successfully`);
      });
    }
  }
  await browser.close();
})();