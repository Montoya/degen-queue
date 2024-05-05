import dotenv from 'dotenv'
dotenv.config()
import { Button, Frog } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel'
import { PrismaClient } from '@prisma/client';
import { NeynarAPIClient } from '@neynar/nodejs-sdk'

const prisma = new PrismaClient();

if (!process.env.NEYNAR_API_KEY) {
  throw new Error("Make sure you set NEYNAR_API_KEY in your .env file");
}

const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  hub: neynar({ apiKey: `${process.env.NEYNAR_API_KEY}` })
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

    const authorResponse = await neynarClient.fetchBulkUsers(authorIds);
    const authors = authorResponse.users; 

    const casts = await neynarClient.fetchBulkCasts(castHashes); 

    return c.html(
      <html>
        <head>
          <title>Your $DEGEN Queue</title>
          <link rel="stylesheet" href="https://unpkg.com/spectre.css/dist/spectre.min.css"/>
          <link rel="stylesheet" href="/styles.css"/>
        </head>
        <body>
          <h1>Your $DEGEN Queue</h1>
          <p>Your $DEGEN allowance for today: {allowance}</p>
          <p>Your remaining balance for today: {remaining}</p>
          <p>{rows.length} casts in your queue:</p>
          {rows.length > 0 &&
            <table>
              {rows.map((row:any, index:number) => (
                <tr key={index}>
                  <td>{row['castAuthor']}</td>
                  <td>{row['castHash']}</td>
                </tr>
              ))}
            </table>
          }
          {rows.length < 1 && 
            <p><em>Add some casts to get started!</em></p>
          }
          <p>{JSON.stringify(authors)}</p>
          <p>{JSON.stringify(casts)}</p>
        </body>
      </html>
    )
    return c.text(`al: ${allowance}, re: ${remaining}`)
  }
  else { 
    return c.text("Not found or no allowance")
  }
})
 
app.frame('/', (c) => {
  return c.res({
    image: (
      <div style={{ color: 'purple', display: 'flex', fontSize: 32, padding: 16 }}>
        Add "Degen Queue" Action
      </div>
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
        <div style={{ color: 'purple', display: 'flex', fontSize: 60 }}>
          You have {castCount} casts in your Degen Queue
        </div>
      ),
      intents: [
        <Button.Link href={redirectLocation}>View My Queue</Button.Link>
      ]
    })
  }
  catch (error) { 
    return c.res({
      image: (
        <div style={{ color: 'purple', display: 'flex', fontSize: 60 }}>
          Error: `${error}`
        </div>
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
