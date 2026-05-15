import sdk from "microsoft-cognitiveservices-speech-sdk";

const speechConfig =
  sdk.SpeechConfig.fromSubscription(

    process.env.AZURE_SPEECH_KEY,

    process.env.AZURE_SPEECH_REGION
  );

speechConfig.speechRecognitionLanguage =
  "en-US";

speechConfig.setProperty(
  sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
  "5000"
);

speechConfig.setProperty(
  sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
  "2000"
);

export {
  sdk,
  speechConfig
};