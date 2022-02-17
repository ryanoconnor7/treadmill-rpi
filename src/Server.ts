import * as express from 'express'
import * as otc from './otc'
import { initializeApp } from 'firebase/app'

const firebaseConfig = {
    apiKey: 'AIzaSyDZzNWJzu5mPDo_CHEfcJzJp9ofSe4LmgE',
    authDomain: 'treadmill-4d65b.firebaseapp.com',
    projectId: 'treadmill-4d65b',
    storageBucket: 'treadmill-4d65b.appspot.com',
    messagingSenderId: '405014925553',
    appId: '1:405014925553:web:b8930c510a51b4355c1950',
    measurementId: 'G-RLT8BVJEH6'
}

const fbApp = initializeApp(firebaseConfig)

const app = express()
const port = 3000

app.get('/status', async (req, res) => {
    return res.status(200).send(true)
})

app.listen(port, () => console.log(`Server listening at http://localhost:${port}`))

otc.connect()
    .then()
    .catch(e => {
        console.log('Not connected')
    })
