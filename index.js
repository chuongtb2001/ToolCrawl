const puppeteer = require('puppeteer')
const fs = require('fs')
const proxyChain = require('proxy-chain')
const useProxy = require('puppeteer-page-proxy')

const proxies = [
  "http://kYEYnV:3STBp4@181.177.103.220:9580",
  "http://kYEYnV:3STBp4@131.108.17.29:9202",
  "http://ABUxEp:sUWc0m@181.177.87.231:9469", //can access
]

let countReq = 0;
let proxyUrlIndex = 0;

async function changeProxy(page){
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
        console.log("Change proxy")
      }
      const oldProxyUrl = proxies[proxyUrlIndex]
      console.log(oldProxyUrl)

      const newProxyUrl = await proxyChain.anonymizeProxy(oldProxyUrl)
      await useProxy(request, newProxyUrl)
    }
  })
}
(async () => {
  const browser = await puppeteer.launch({})
  const page = await browser.newPage()
  await changeProxy(page, proxies[proxyUrlIndex])

  let pageNumber = 1  
  // get products
  while (pageNumber < 100) {
    const productInfo = {
      productUrl: "",
      productName: "",
      productPrice: "",
      productPriceSale: "",
      productImgs: [],
    }
    const mainPage = await page.goto(
        `https://www.fanatics.com/nba/los-angeles-lakers/men/o-2447+t-69584146+ga-56+z-820-817603699?pageSize=72&pageNumber=${pageNumber}&sortOption=TopSellers`,
        { timeout: 100000 }
      )
      // const data = await useProxy.lookup(page)
      // console.log(data.ip)
      // change ip
    const productHrefList = await page.$$eval(
      ".product-image-container a",
      (elements) => {
        return elements.map((el) => el.href)
      }
    )
    for (const productHref of productHrefList) {
      //
      productInfo.productUrl = productHref
      //get page
      try {
        const pageProduct = await page.goto(productHref, { timeout: 300000 })
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
        productInfo.productImgs = []
      }
      //import new product to csv
      fs.appendFile("output.csv", `${productInfo.productUrl},${productInfo.productName},${productInfo.productPrice},${productInfo.productPriceSale},"${productInfo.productImgs.toString()}"\n`, (err) => {
        if (err) throw err
        console.log(`${productInfo.productName} is saved successfully`)
        console.log("---")
      })
    }
  }
  await browser.close()
})()
