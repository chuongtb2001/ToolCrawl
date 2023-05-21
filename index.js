const puppeteer = require('puppeteer')
const fs = require('fs')
const proxyChain = require('proxy-chain')
const useProxy = require('puppeteer-page-proxy')

const proxies = [
  "http://kYEYnV:3STBp4@181.177.103.220:9580",
  "http://kYEYnV:3STBp4@131.108.17.29:9202",
  "http://ABUxEp:sUWc0m@181.177.87.231:9469",
]

let filename = ''
let countReq = 0;
let proxyUrlIndex = 0;

async function getTeamURL () {
  const data =  await fs.promises.readFile('link.txt', 'utf8')
  return data.split('\r\n')
}

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
  const teamsUrl = await getTeamURL() 

  console.log("Start crawl")
  console.log("Proxy current use: "+ proxies[proxyUrlIndex])

  for (const item of teamsUrl) {
    let pageNumber = 0
    while (true) {
      pageNumber += 1
      //go to page have list products
      try {
        await page.goto(
          item + `?pageNumber=${pageNumber}`,
          { timeout: 100000 }
        );
      } catch (error) {
        console.log(error)
        console.log("---\nERROR")
        console.log("Failed to load page: " + `${item + `?pageNumber=${pageNumber}`}\n---`)
        await fs.promises.appendFile(
          "error.csv",
          `${item + `?pageNumber=${pageNumber}`}\n`
        );
      }
      const productHrefList = await page.$$eval(
        ".product-card.row .product-image-container a",
        (elements) => {
          return elements.map((el) => el.href)
        }
      )
      //check product list is empty
      console.log(productHrefList.length)
      if (productHrefList.length < 1) {
        break
      }
      //get file name through breadcrumb-text
      filename = await page.$eval(
        ".breadcrumb-text",
        (el) => el.textContent
      )
      for (const productHref of productHrefList) {
        //init product information
        const productInfo = {
          productUrl: "",
          productName: "",
          productPrice: "",
          productPriceSale: "",
          productImgs: [],
          productSize: [],
          productDescription: "",
          productCustom: false,
        }
        productInfo.productUrl = productHref
        //go to page
        try {
          const pageProduct = await page.goto(productHref, { timeout: 100000 })
          if (pageProduct.status() !== 200) {
            continue
          }
          const titlePage = await page.title()
          if (titlePage === "Access Denied") {
            console.log("---\nERROR\n" + proxies[proxyUrlIndex])

          }
        } catch (error) {
          console.log(error)
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
        productInfo.productImgs = await page.$$eval(
          ".thumbnail-images img",
          (elements) => elements.map((el) => el.src)
        )
        if (productInfo.productImgs.length < 1) {
          //case product has 1 image
          try {
            const link = await page.$eval(".product-images img", (el) => el.src);
            productInfo.productImgs = [link];
          } catch (error) {
            productInfo.productImgs = []
          }
        }
        //get product size
        productInfo.productSize = await page.$$eval(
          ".buy-box-size-selector .size-text",
          (elements) => elements.map((el) => el.textContent)
        )
        //get product description
        try {
          productInfo.productDescription = await page.$eval(
            ".product-description .description-box-content div",
            (el) => el.textContent
          )
        } catch (error) {
          productInfo.productDescription = ""
        }
        //check product have custom properties
        try {
          productInfo.productCustom = await page.$eval(
            ".buy-box-custom-options-container",
            (el) => el.hasChildNodes()
          )
        } catch (error) {
          productInfo.productCustom = false
        }
        //import new product to csv
        try {
          await fs.promises.appendFile(
            `${filename}.csv`,
            `${productInfo.productUrl},${productInfo.productName},${productInfo.productPrice},${productInfo.productPriceSale},"${productInfo.productImgs.toString()}","${productInfo.productSize.toString()}",${productInfo.productCustom},"${productInfo.productDescription}"\n`
          );
          console.log(`---\n${productInfo.productName} is saved successfully\n---`)
        } catch (error) {
          console.log("---\nERROR")
          console.log(`${productInfo.productName} is save failure\n---`)
        }
      }
    }
  }

  console.log("Crawl done")
  await browser.close()
})()
