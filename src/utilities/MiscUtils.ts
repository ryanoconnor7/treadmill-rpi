import { exec } from 'child_process'

export async function sh(cmd) {
    const promise: Promise<{ stdout: string; stderr: string }> = new Promise((resolve, reject) => {
        exec(cmd, (err, stdout: string, stderr: string) => {
            if (err) {
                reject(err)
            } else {
                resolve({ stdout, stderr })
            }
        })
    })
    return promise
}

export const promiseTimeout = (ms, promise) => {
    // Create a promise that rejects in <ms> milliseconds
    const timeout = new Promise((resolve, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id)
            reject('Timed out in ' + ms + 'ms.')
        }, ms)
    })

    // Returns a race between our timeout and the passed in promise
    return Promise.race([promise, timeout])
}
