import * as express from 'express'
import { initializeApp } from 'firebase/app'
import { Controller } from './Controller'
import { getDatabase } from '@firebase/database'

const firebaseConfig = {
    apiKey: 'AIzaSyALTboEJgohraJw0pj1bACrvBZkDdb_7Eg',
    authDomain: 'treadmill-2.firebaseapp.com',
    databaseURL: 'https://treadmill-2-default-rtdb.firebaseio.com',
    projectId: 'treadmill-2',
    storageBucket: 'treadmill-2.appspot.com',
    messagingSenderId: '987750487745',
    appId: '1:987750487745:web:a39a8327465dffb30c6640',
    measurementId: 'G-ECNJ6R7D5G'
}

export const fbApp = initializeApp(firebaseConfig)
export const db = getDatabase(fbApp)

const app = express()
const port = 3000

app.get('/status', async (req, res) => {
    return res.status(200).send(true)
})

app.listen(port, () => console.log(`Server listening at http://localhost:${port}`))

// otc.connect()
//     .then()
//     .catch(e => {
//         console.log('Not connected')
//     })

let c = new Controller()
c.start('demo', 0)
