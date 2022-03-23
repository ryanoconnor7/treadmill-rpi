export interface Update {
    state: string
    timestamp: number
}

export interface Camera {
    description: string
    units: Unit[]
    updates: Update[]
}
