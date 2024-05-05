import dotenv from 'dotenv'
dotenv.config()
import { Button, Frog } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel'
import { PrismaClient } from '@prisma/client'
import { NeynarAPIClient } from '@neynar/nodejs-sdk'

import {
  Box,
  Heading,
  Text,
  VStack,
  vars,
} from './ui.js'

const prisma = new PrismaClient();

if (!process.env.NEYNAR_API_KEY) {
  throw new Error("Make sure you set NEYNAR_API_KEY in your .env file");
}

const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  hub: neynar({ apiKey: `${process.env.NEYNAR_API_KEY}` }),
  ui: { vars }
})

app.get('/db-read', async (c) => { 
  const today = new Date();
  today.setHours(0,0,0,0); 
  const result = await prisma.likes.findMany({
    where: { 
      fid: { 
        equals: 4275,
      },
      createdAt: {
        gt: today
      }
    }
  })
  return c.json(result); 
})

app.get('/queue/:fid', async (c) => { 
  const fid = c.req.param('fid')
  const response = await fetch(`https://www.degen.tips/api/airdrop2/tip-allowance?fid=${fid}`)
  const data = await response.json()
  if(data.length > 0) { 
    const allowance = data[0]['tip_allowance']
    const remaining = data[0]['remaining_allowance']
    const today = new Date();
    today.setHours(0,0,0,0); 
    const rows = await prisma.likes.findMany({
      where: { 
        fid: { 
          equals: parseInt(fid),
        },
        createdAt: {
          gt: today
        }
      }
    })

    let authors:Array<any> = []; 
    let casts:Array<any> = []; 
    let tipAmount = remaining; 
    let finalTipAmount = remaining; 
    if(rows.length > 0) { 
      // fetch all the user data we need 
      const authorIds:Array<number> = []
      // fetch all the cast data we need 
      const castHashes:Array<string> = []
      rows.map((row:any) => {
        if(!authorIds.includes(row['castAuthor'])) { 
          authorIds.push(row['castAuthor'])
        }
        castHashes.push(row['castHash'])
      })

      const authorResponse = await neynarClient.fetchBulkUsers(authorIds)
      authors = authorResponse.users

      const castResponse = await neynarClient.fetchBulkCasts(castHashes)
      casts = castResponse.result?.casts

      if(casts.length > 0) { 
        tipAmount = Math.ceil(remaining / casts.length)
        let excess = (tipAmount * casts.length) - remaining; 
        finalTipAmount = tipAmount - excess; 
      }
    }

    return c.html(
      <html>
        <head>
          <title>Your $DEGEN Queue</title>
          <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre.min.css"/>
          <link rel="stylesheet" href="/styles.css"/>
        </head>
        <body>
          <div id="page">
            <h1>Your $DEGEN Queue</h1>
            <p>Your $DEGEN allowance: {allowance}</p>
            <p>Your remaining balance: {remaining}</p>
            <p>{casts?.length} casts in your queue:</p>
            {casts.length > 0 &&
              <table>
                <tr>
                  <th>Author</th>
                  <th>Cast URL</th>
                  <th>Amount to tip</th>
                </tr>
                {casts?.map((row:any, index:number) => (
                  <tr key={index}>
                    <td>
                      <img src={row["author"]["pfp_url"]} width="24" height="24"/> 
                      {row["author"]["display_name"]}
                    </td>
                    <td>
                      <a href={
                        "https://warpcast.com/"+
                        row["author"]["username"]+
                        "/"+
                        row["hash"].slice(0,10)
                      } target="_blank">URL</a>
                    </td>
                    <td>
                      {index==(casts.length-1) ? finalTipAmount : tipAmount}
                    </td>
                  </tr>
                ))}
              </table>
            }
            {casts.length < 1 && 
              <p><em>Add some casts to get started!</em></p>
            }
            <p>Built by <a href="https://warpcast.com/m0nt0y4" target="_blank">@m0nt0y4</a> and <a href="https://warpcast.com/jcqln" target="_blank">@jcqln</a> for FarHack 2024
            </p>
          </div>
        </body>
      </html>
    )
    /*

            <h2>Authors</h2>
            <textarea>{JSON.stringify(authors)}</textarea>
            <h2>Casts</h2>
            <textarea>{JSON.stringify(casts)}</textarea>
    */
  }
  else { 
    return c.text("Not found or no allowance")
  }
})
 
app.frame('/', (c) => {
  return c.res({
    image: (
      <Box 
        grow 
        backgroundColor={'background200'}
        padding='32' 
        alignVertical='top'
      >
        <VStack gap='24'>
          <Heading>Degen Queue Action</Heading>
          <Text>Ever struggle to keep track of all the great casts you want to tip?</Text>
          <Text>Degen Queue makes it easy!</Text>
          <Text>With the Degen Queue action, you can add your favorite casts to a queue and then allocate your $DEGEN tip balance fairly.</Text>
          <Text>Just add the cast action below, then add casts to your queue to get started.</Text>
        </VStack>
      </Box>
    ),
    intents: [
      <Button.AddCastAction action="/add-to-degen-queue">
        Add
      </Button.AddCastAction>,
    ]
  })
})
 
app.castAction(
  '/add-to-degen-queue',
  async (c) => {
    const { actionData } = c
    const { castId, fid, messageHash, network, timestamp, url } = actionData
    try { 
      await prisma.likes.create({
        data: { 
          fid: fid, 
          messageHash: `${messageHash}`, 
          network: `${network}`, 
          timestamp: `${timestamp}`, 
          url: `${url}`, 
          castAuthor: castId.fid, 
          castHash: `${castId.hash}`,
        }
      }); 
    } catch(error) { 
      
    } 
    return c.res({ type: 'frame', path: '/degen-queue-frame-response' })
  },
  { name: "Add to Degen Queue", icon: "plus" }
)

app.frame('/degen-queue-frame-response', async (c) => {
  try { 
    let viewer = c.frameData?.fid 
    const today = new Date();
    today.setHours(0,0,0,0); 
    const castCount = await prisma.likes.count({
      where: {
        fid: {
          equals: viewer,
        },
        createdAt: {
          gt: today
        }
      },
    })
    const redirectLocation = `https://degen-queue.vercel.app/api/queue/${viewer}`
    return c.res({
      image: (
        <Box 
        grow 
        backgroundColor={'background200'}
        padding='32' 
        alignVertical='top'
      >
        <VStack gap='32'>
          <Heading>Cast Added!</Heading>
          <Text>You have {castCount} casts in your Degen Queue.</Text>
          <Text>Click the button to see your queue and start tipping!</Text>
        </VStack>
      </Box>
      ),
      intents: [
        <Button.Link href={redirectLocation}>View My Queue</Button.Link>
      ]
    })
  }
  catch (error) { 
    return c.res({
      image: (
        <Box 
        grow 
        backgroundColor={'background200'}
        padding='32' 
        alignVertical='top'
      >
        <VStack gap='32'>
          <Heading>Error</Heading>
          <Text>{error as string}</Text>
        </VStack>
      </Box>
      )
    })
  }
})

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined'
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
