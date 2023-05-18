const puppeteer = require('puppeteer')
const fs = require('fs')
const proxyChain = require('proxy-chain')
const useProxy = require('puppeteer-page-proxy')

const proxies = [
  "http://kYEYnV:3STBp4@181.177.103.220:9580",
  "http://kYEYnV:3STBp4@131.108.17.29:9202",
  "http://ABUxEp:sUWc0m@181.177.87.231:9469",
]

let countReq = 0;
let proxyUrlIndex = 0;

async function setUpProxy(page){
  page.removeAllListeners("request")

  await page.setRequestInterception(true)
  page.on("request", async (request) => {
    if (request.resourceType() !== "document") {
      request.abort()
    } else {
      countReq += 1
      if(countReq > 20) {
        proxyUrlIndex =
          proxyUrlIndex >= proxies.length - 1 ? 0 : proxyUrlIndex + 1
        //reset count request
        countReq = 0
        console.log("Change proxy: ", proxies[proxyUrlIndex])
      }
      const oldProxyUrl = proxies[proxyUrlIndex]
      const newProxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl)
      await useProxy(request, newProxyUrl)
    }
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await puppeteer.launch({})
  const page = await browser.newPage()
  // await page.setUserAgent(
  //   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36'
  //  )
  await setUpProxy(page)

  console.log("Start crawl")
  console.log("Proxy current use: "+ proxies[proxyUrlIndex])

  let pageNumber = 0
  while (true) {
    pageNumber += 1
    //go to page have list products
    try {
      await page.goto(
        `https://www.fanatics.com/nba/los-angeles-lakers/men/o-2447+t-69584146+ga-56+z-820-817603699?pageSize=72&pageNumber=${pageNumber}&sortOption=TopSellers`,
        { timeout: 60000 }
      );
    } catch (error) {
      console.log("---\nERROR")
      console.log("Failed to load page: " + `https://www.fanatics.com/nba/los-angeles-lakers/men/o-2447+t-69584146+ga-56+z-820-817603699?pageSize=72&pageNumber=${pageNumber}&sortOption=TopSellers\n---`)
      await fs.promises.appendFile(
        "error.csv",
        `https://www.fanatics.com/nba/los-angeles-lakers/men/o-2447+t-69584146+ga-56+z-820-817603699?pageSize=72&pageNumber=${pageNumber}&sortOption=TopSellers\n`
      );
    }
    const productHrefList = await page.$$eval(
      ".product-image-container a",
      (elements) => {
        return elements.map((el) => el.href)
      }
    )
    //check product list is empty
    if (productHrefList.length < 1) {
      break
    }

    for (const productHref of productHrefList) {
      //init product information
      const productInfo = {
        productUrl: "",
        productName: "",
        productPrice: "",
        productPriceSale: "",
        productImgs: [],
      }
      productInfo.productUrl = productHref
      //go to page
      try {
        const pageProduct = await page.goto(productHref, { timeout: 60000 })
        if (pageProduct.status() !== 200) {
          continue
        }
      } catch (error) {
        console.log("---\nERROR")
        console.log("Failed to load page: " + `${productHref}\n---`)
        await fs.promises.appendFile("error.csv", `${productHref}"\n`);
        continue
      }
      //get information about products
      //get product name
      try {
        productInfo.productName = await page.$eval(
          ".product-title-container h1",
          (el) => el.textContent
        )
      } catch (error) {
        productInfo.productName = ""
      }
      //get product origin price
      try {
        productInfo.productPrice = await page.$eval(
          ".pdp-price .price:not(.primary) .sr-only",
          (el) => el.textContent
        )
      } catch (error) {
        productInfo.productPrice = ""
      }
      //get product sale price
      try {
        productInfo.productPriceSale = await page.$eval(
          ".pdp-price .price.primary .sr-only",
          (el) => el.textContent
        )
      } catch (error) {
        productInfo.productPriceSale = ""
      }
      //get product images
      try {
        productInfo.productImgs = await page.$$eval(
          ".thumbnail-images img",
          (elements) => elements.map((el) => el.src)
        )
      } catch (error) {
        //case product has 1 image
        try {
          const link = await page.$eval(".product-images img", (el) => el.src);
          productInfo.productImgs = [link];
        } catch (error) {
          productInfo.productImgs = [];
        }
      }
      //import new product to csv
      try {
        await fs.promises.appendFile(
          "output.csv",
          `${productInfo.productUrl},${productInfo.productName},${productInfo.productPrice},${productInfo.productPriceSale},"${productInfo.productImgs.toString()}"\n`
        );
        console.log(`---\n${productInfo.productName} is saved successfully\n---`)
      } catch (error) {
        console.log("---\nERROR")
        console.log(`${productInfo.productName} is save failure\n---`)
      }
    }
  }
  await browser.close()
})()
