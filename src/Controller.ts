import { onValue, ref, set, update } from '@firebase/database'
import { db } from './Server'
import { Camera, Update } from './utilities/Firebase'
import { sh } from './utilities/MiscUtils'

export class Controller {
    public cameraID = 0
    public locationID = 'demo'
    public updateInterval = 5 * 60 * 1000 // 5 minutes
    public oldestUpdate = 7 * 24 * 60 * 60 * 1000 // 1 week

    public updateUnsub
    public camera: Camera

    public start(locationID: string, cameraID: number) {
        this.locationID = locationID
        this.cameraID = cameraID

        const settingsRef = ref(db, `settings`)

        onValue(
            settingsRef,
            async snapshot => {
                clearInterval(this.updateUnsub)
                const settings = snapshot.val()
                console.log('SETTINGS:', settings)
                this.updateInterval = settings.update_spacing
                this.oldestUpdate = settings.oldest_update

                const cameraRef = ref(db, `locations/${this.locationID}/cameras/${this.cameraID}`)
                // const updatesRef = ref(db, `locations/${this.locationID}/cameras/${this.cameraID}/updates`)
                const unsubscribe = onValue(cameraRef, async snapshot => {
                    unsubscribe()
                    this.camera = snapshot.val()
                    this.updateUnsub = setInterval(this.getThermalData, settings.update_freq)
                })
            },
            onError => {
                setTimeout(this.start, 10000)
            }
        )
    }

    getThermalData = async () => {
        try {
            const result = await sh('bash /home/pi/thermal-scripts/test.sh')
            const parsedState = this.parseState(result.stdout)
            const stringRep = this.parsedStateToString(parsedState)
            console.log('Parsed state:', parsedState)
            this.publishUpdate({
                state: result.stdout,
                timestamp: Date.now()
            })
        } catch (e) {
            console.log('getThermalData error:', e)
        }
    }

    parseState = (state: string): number[][] => {
        const rows = state.trim().split('\n')
        return rows.map(rowRaw => {
            return rowRaw
                .trim()
                .split(' ')
                .map(v => +v)
        })
    }

    parsedStateToString = (state: number[][]) => {
        let string = ''
        state.forEach(row => {
            row.forEach((col, index) => {
                string += `${index !== 0 ? ' ' : ''}${col}`
            })
            string += '\n'
        })
        return string
    }

    publishUpdate = async (newUpdate: Update) => {
        const camera = this.camera

        if (!camera.updates) camera.updates = []

        camera.updates.push(newUpdate)
        camera.updates.reverse()

        let newUpdates: Update[] = []
        let now = Date.now()
        let buffer = now % this.updateInterval
        let startPeriod = now - buffer
        let updatesToCollapse: Update[] = []

        console.log('updates count:', camera.updates.length)
        camera.updates.forEach((update, i) => {
            if (update.timestamp < now - this.oldestUpdate) {
                console.log('Dropping 1 update')
                return
            }
            if (update.timestamp > now - this.updateInterval - (now % this.updateInterval)) {
                // console.log('Adding 1 RT update')
                newUpdates.push(update)
            } else if (
                newUpdates.length > 0 &&
                newUpdates[newUpdates.length - 1].timestamp - update.timestamp > this.updateInterval
            ) {
                console.log(
                    'Adding update with min difference:',
                    (camera.updates[i - 1].timestamp - update.timestamp) / 60 / 1000
                )
                newUpdates.push(update)
            } else {
                console.log('1 skipped update', now, update.timestamp)
            }
        })

        camera.updates = newUpdates
        camera.updates.reverse()

        const updates = {}
        updates[`locations/${this.locationID}/cameras/${this.cameraID}/updates`] = camera.updates
        await update(ref(db), updates)
    }
}

/*
if (update.timestamp > startPeriod - INTERVAL) {
                    console.log('Adding 1 to collapsed')
                    updatesToCollapse.push(update)

                    if (
                        i === camera.updates.length - 1 ||
                        camera.updates[i + 1].timestamp < startPeriod - INTERVAL
                    ) {
                        const parsedUpdates = updatesToCollapse.map(u => this.parseState(u.state))
                        console.log('Collapsing', updatesToCollapse.length, 'updates')

                        let averaged = parsedUpdates[0]
                        parsedUpdates.forEach(p => {
                            p.forEach((row, rIdx) => {
                                row.forEach((col, cIdx) => {
                                    averaged[rIdx][cIdx] = Math.max(averaged[rIdx][cIdx], col)
                                })
                            })
                        })

                        newUpdates.push({
                            state: this.parsedStateToString(averaged),
                            timestamp: startPeriod
                        })

                        updatesToCollapse = []
                        startPeriod -= INTERVAL
                    }
                } 

                */
