export function kitRecommendation(feelsLikeF: number | null, windMph: number | null): string {
  const veryCold = feelsLikeF != null && feelsLikeF < 45;
  const coldOrWindy = (feelsLikeF != null && feelsLikeF < 55) || (windMph != null && windMph > 15);
  const cool = feelsLikeF != null && feelsLikeF < 65;

  if (veryCold) return "Insulated jacket + long sleeves";
  if (coldOrWindy) return "Windbreaker + long sleeves";
  if (cool) return "Arm warmers or a light layer";
  return "Standard kit — no extra layers needed";
}
