import type { Vehicle } from "../motorist/model.ts"
import type { MotoristProfile } from "../motorist/profileModel.ts"
import type { Workspace } from "./dispatch.ts"

export type AccountSession = {
  userId: string
  profile: MotoristProfile
  bookingUpdates: boolean
  vehicles: Vehicle[]
  workspaces: Workspace[]
  providers: { id: string; name: string; area: string }[]
}

export type AccountClient = {
  session: AccountSession
  pending: boolean
  error: string
  saveProfile(profile: MotoristProfile): Promise<boolean>
  savePreference(enabled: boolean): Promise<boolean>
  saveVehicle(vehicle: Vehicle): Promise<boolean>
  removeVehicle(id: string): Promise<boolean>
}
