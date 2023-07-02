import express, { Request, Response } from 'express'
import axios from 'axios'
import cheerio from 'cheerio'
import path from 'path'

const app = express()
const port = process.env.PORT || 3000

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  const ip = req.ip

  // Retrieve package.json data
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json')
  const packageJson = require(packageJsonPath)

  const response = {
    port,
    ip,
    description: packageJson.description,
    version: packageJson.version,
    creator: packageJson.author,
    repository: packageJson.repository.url,
    links: {
      self: { href: '/', method: 'GET', desc: 'Root-URL of the Lunch-Scraper Rest-API' },
      api: { href: '/village', method: 'GET', desc: 'This weeks daily lunch choices from the restaurant Village at CityGate, in Gårda, Gothenburg' }
    }
  }

  res.json(response)
})

// Village endpoint
app.get('/village', async (req: Request, res: Response) => {
  try {
    const menu = await scrapeMenu()
    res.json(menu)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'An error occurred' })
  }
})

async function scrapeMenu() {
  const response = await axios.get('https://www.compass-group.se/village')
  const $ = cheerio.load(response.data)

  const menu: { weekNumber: string; days: { name: string; choices: string[] }[] } = { weekNumber: '', days: [] }
  let currentDay: { name: string; choices: string[] } | null = null

  $('.c-article__content').each((index: any, element: any) => {
    const menuText = $(element).text()

    const menuLines = menuText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')

    const swedishDays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag']

    for (const line of menuLines) {
      if (line.startsWith('Lunchmeny vecka')) {
        menu.weekNumber = line.replace('Lunchmeny vecka', '').trim()
      } else if (swedishDays.includes(line)) {
        const dayName = line.trim()
        currentDay = { name: dayName, choices: [] }
        menu.days.push(currentDay)
      } else if (currentDay) {
        const isClosed = line.toLowerCase().includes('stängt') || line.toLowerCase().includes('stängd')
        if (isClosed) {
          currentDay.choices = ['Stängt']
          currentDay = null // Reset currentDay to prevent further choices from being added
        } else if (currentDay.choices.length < 3) {
          currentDay.choices.push(line)
        }
      }
    }
  })

  return menu
}

app.listen(port, () => {
  console.clear()
  console.log(`Server is running on http://localhost:${port}`)
})
