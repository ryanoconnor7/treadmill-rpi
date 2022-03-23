export interface Update {
    state: string
    timestamp: number
}

export interface Unit {
    bbox: string
    type: string
}

export interface Camera {
    description: string
    units: Unit[]
    updates: Update[]
}
