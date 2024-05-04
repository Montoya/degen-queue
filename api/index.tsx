import { Button, Frog } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel'
import { sql } from '@vercel/postgres'

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
})

app.get('/db-read', async (c) => { 
  const result = await sql`SELECT * FROM Likes`;
  return c.json(result); 
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
      app.post()
      await sql`INSERT INTO Likes (fid, messageHash, network, timestamp, url, castAuthor, castHash) 
        VALUES (${fid}, '${messageHash}', '${network}', '${timestamp}', '${url}', ${castId.fid}, '${castId.hash}')`
    } catch(error) { 
      return c.error({ message: `${error}` }); 
    } 
    return c.res({ type: 'frame', path: '/degen-queue-frame-response' })
  },
  { name: "Add to Degen Queue", icon: "plus" }
)

app.frame('/degen-queue-frame-response', async (c) => {
  try { 
    let viewer = c.frameData?.fid
    const result = await sql`SELECT COUNT(url) FROM Likes WHERE fid=${viewer}`
    return c.res({
      image: (
        <div style={{ color: 'purple', display: 'flex', fontSize: 60 }}>
          ${result}
        </div>
      )
    })
  }
  catch (error) { 
    return c.res({
      image: (
        <div style={{ color: 'purple', display: 'flex', fontSize: 60 }}>
          ${error}
        </div>
      )
    })
  }
})

/*
app.frame('/', (c) => {
  const { buttonValue, inputText, status } = c
  const fruit = inputText || buttonValue
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background:
            status === 'response'
              ? 'linear-gradient(to right, #432889, #17101F)'
              : 'black',
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {status === 'response'
            ? `Nice choice.${fruit ? ` ${fruit.toUpperCase()}!!` : ''}`
            : 'Welcome!'}
        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Enter custom fruit..." />,
      <Button value="apples">Apples</Button>,
      <Button value="oranges">Oranges</Button>,
      <Button value="bananas">Bananas</Button>,
      status === 'response' && <Button.Reset>Reset</Button.Reset>,
    ],
  })
}) */

// @ts-ignore
const isEdgeFunction = typeof EdgeFunction !== 'undefined'
const isProduction = isEdgeFunction || import.meta.env?.MODE !== 'development'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)
