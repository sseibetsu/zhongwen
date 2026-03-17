// 100% вайбкода
import { ref } from "vue";

export function useWebSpeech() {
  const isListening = ref(false);
  const isSpeaking = ref(false);

  // Слушаем микрофон и переводим в текст
  const listen = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Поддержка разных браузеров
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return reject("Голосовой ввод не поддерживается браузером");

      const recognition = new SpeechRecognition();
      recognition.lang = "zh-CN"; // Строго китайский язык
      recognition.interimResults = false;

      recognition.onstart = () => { isListening.value = true; };
      recognition.onresult = (event: any) => resolve(event.results[0][0].transcript);
      recognition.onerror = (event: any) => reject(event.error);
      recognition.onend = () => { isListening.value = false; };

      recognition.start();
    });
  };

  // Озвучиваем текст
  const speak = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) return resolve();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN"; // Китайский голос
      utterance.rate = 0.9;     // Чуть замедляем для понятности

      utterance.onstart = () => { isSpeaking.value = true; };
      utterance.onend = () => {
        isSpeaking.value = false;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  return { listen, speak, isListening, isSpeaking };
}