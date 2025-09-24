export const UserPreferences = {
  create: async (data) => {
    // TODO: call backend here
    console.log('Saving preferences...', data)
    await new Promise(r => setTimeout(r, 600))
    return { ok: true }
  }
}
