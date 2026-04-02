export async function fetchJPYtoCAD(): Promise<{ rate: number; date: string }> {
  try {
    const response = await fetch(
      'https://www.bankofcanada.ca/valet/observations/FXJPYCAD/json?recent=1'
    )
    const data = await response.json()
    const latest = data.observations[0]
    return {
      rate: parseFloat(latest.FXJPYCAD.v),
      date: latest.d
    }
  } catch (error) {
    return { rate: 0.0092, date: new Date().toISOString().split('T')[0] }
  }
}
