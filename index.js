const puppeteer = require('puppeteer');
const fs = require('fs');
const Papa = require('papaparse');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  let pageNumber = 0
  // let amountPerPage = 1
  let productsJson = []
  //get products in page < 1
  while (pageNumber < 1) {
    pageNumber += 1
    console.log("--------------------------------")
    const productInfo = {
      productName: "",
      productPrice: "",
      productPriceSale: "",
      productImgs: []
    }
    const pageList = await page.goto(`https://www.fanatics.com/nba/los-angeles-lakers/men/o-2447+t-69584146+ga-56+z-820-817603699?pageSize=72&pageNumber=${pageNumber}&sortOption=TopSellers`);
    if (pageList.status() !== 200) {
      continue
    }
    const productHrefList = await page.$$eval('.product-image-container a', (elements) => {
      return elements.map(el => el.href)
    });
    for (const productHref of productHrefList) {
      //get page
      try {
        const pageProduct = await page.goto(productHref);
        if (pageProduct.status() !== 200) {
          continue
        }
      } catch (error) {
        console.log(error)
        continue
      }
      //get information about products

      //get product name
      try {
        productInfo.productName = await page.$eval('.product-title-container h1', (el) => el.textContent);
      } catch (error) {
        productInfo.productName = ""
      }
      //get product origin price  
      try {
        productInfo.productPrice = await page.$eval('.pdp-price .price:not(.primary) .sr-only', (el) => el.textContent);
      } catch (error) {
        productInfo.productPrice = ""
      }
      //get product sale price
      try {
        productInfo.productPriceSale = await page.$eval('.pdp-price .price.primary .sr-only', (el) => el.textContent);
      } catch (error) {
        productInfo.productPriceSale = ""
      }
      //get product images
      try {
        productInfo.productImgs = await page.$$eval('.thumbnail-images img', (elements) => elements.map(el => el.src));
      } catch (error) {
        productInfo.productImgs = []
      }

      productsJson = [productInfo]
      console.log("Crawl done: " + productInfo.productName)
      //import new product to csv
      const csv = Papa.unparse(productsJson)
      fs.appendFile('output.csv', csv, (err) => {
        if (err) throw err;
        console.log(`${productInfo.productName} is saved successfully`);
      });
    }
    // amountPerPage = productHrefList.length
  }
  await browser.close();
})();