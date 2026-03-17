<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref, watch } from "vue";

import { Card } from "~/components/ui/card";
import { Link } from "~/components/ui/link";
import { useDictionaryModules } from "~/composables/useDictionaries";
import { useWebSpeech } from "~/composables/useWebSpeech";
import { getCardStyle } from "~/lib/cardStyles";
import { formatDictName } from "~/lib/formatters";
import type { Word } from "~/lib/types";

const QUEUE_SIZE = 10;

function pickRandom<T>(arr: T[], count: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(count, arr.length));
}

// ── route & view ─────────────────────────────────────────────────────────────
const route = useRoute();
const dictId = computed(() => ((route.params.slug ?? route.params.id) as string) ?? "");
const isModeSelect = computed(() => route.path === "/speaking");
const isDictList = computed(() => route.path === "/speaking/words" && !dictId.value);
const isPractice = computed(() => Boolean(dictId.value));
const isSentences = computed(() => route.path === "/speaking/sentences");

// ── Web Speech API (замена ElevenLabs и серверной транскрибации) ─────────────
const { listen, speak: webSpeak, isListening, isSpeaking } = useWebSpeech();

// ── AI Roleplay State (Для режима Sentences) ─────────────────────────────────
const chatHistory = ref<{ role: string, parts: string }[]>([]);
const isChatLoading = ref(false);

async function startConversation() {
  if (isListening.value || isChatLoading.value || isSpeaking.value) return;
  
  try {
    // 1. Слушаем пользователя
    const userText = await listen();
    if (!userText.trim()) return;

    chatHistory.value.push({ role: "user", parts: userText });
    isChatLoading.value = true;
    
    // 2. Отправляем на наш Python-сервер
    const response = await $fetch("http://localhost:8000/chat", {
      method: "POST",
      body: {
        history: chatHistory.value.slice(0, -1), // Отправляем историю без последней фразы
        message: userText
      }
    });

    // 3. Сохраняем и озвучиваем ответ
    chatHistory.value.push({ role: "model", parts: response.reply });
    await webSpeak(response.reply);

  } catch (error) {
    console.error("Ошибка диалога:", error);
    apiError.value = typeof error === 'string' ? error : "Ошибка соединения с сервером";
  } finally {
    isChatLoading.value = false;
  }
}

// ── mode select ─────────────────────────────────────────────────────────────
const modes = [
  {
    title: "Words",
    description: "Practise pronunciation word by word",
    to: "/speaking/words",
    ...getCardStyle(0, "main"),
  },
  {
    title: "AI Roleplay", // Переименовали Sentences
    description: "Practise dialogue with AI Professor",
    to: "/speaking/sentences",
    ...getCardStyle(1, "main"),
  },
];

// ── dictionaries (for list & practice) ─────────────────────────────────────
const modules = useDictionaryModules();

const dictionaries = computed(() => {
  return Object.entries(modules).map(([path], index) => {
    const filename = path.split("/").pop() || "";
    const id = filename.replace(".json", "");
    const { icon, tone } = getCardStyle(index, "vocabulary");
    return {
      id,
      title: formatDictName(id),
      icon,
      tone,
    };
  });
});

const allWords = computed<Word[]>(() => {
  if (!dictId.value) return [];
  const entry = Object.entries(modules).find(([path]) => path.endsWith(`${dictId.value}.json`));
  return entry?.[1] ?? [];
});

const dictTitle = computed(() => formatDictName(dictId.value));

const queue = ref<Word[]>([]);
const currentIndex = ref(0);
const score = ref(0);
const done = ref(false);
const revealed = ref(false);
const lastResult = ref<"correct" | "incorrect" | null>(null);
const transcribedText = ref("");
const apiError = ref<string | null>(null);

const currentWord = computed(() => queue.value[currentIndex.value] ?? null);
const progress = computed(() => queue.value.length ? (currentIndex.value / queue.value.length) * 100 : 0);

function initQueue() {
  queue.value = pickRandom(allWords.value, QUEUE_SIZE);
  currentIndex.value = 0;
  score.value = 0;
  done.value = false;
  revealed.value = false;
  lastResult.value = null;
  transcribedText.value = "";
  apiError.value = null;
}

watch(() => dictId.value, (id) => { if (id) initQueue(); }, { immediate: true });

// ── helpers ─────────────────────────────────────────────────────────────────
function normalize(text: string): string {
  return text.replace(/[\s.,!?。，！？]/g, "").toLowerCase(); // Добавил китайскую пунктуацию
}

function isMatch(transcription: string, word: Word): boolean {
  const t = normalize(transcription);
  return t.includes(normalize(word.hanzi)) || t === normalize(word.pinyin);
}

// ── new recording (Words mode) ───────────────────────────────────────────────
async function checkWordPronunciation() {
  if (isListening.value || !currentWord.value || isSpeaking.value) return;
  apiError.value = null;
  
  try {
    const text = await listen();
    transcribedText.value = text;
    
    const correct = isMatch(text, currentWord.value);
    if (correct) {
      score.value++;
      lastResult.value = "correct";
    } else {
      lastResult.value = "incorrect";
      // Если ошибка - ИИ озвучивает правильный вариант
      await webSpeak(currentWord.value.hanzi);
    }
    
    setTimeout(() => {
        if (currentIndex.value < queue.value.length - 1) {
          currentIndex.value++;
          revealed.value = false;
          lastResult.value = null;
          transcribedText.value = "";
          apiError.value = null;
        } else {
          done.value = true;
        }
    }, 1500);

  } catch (e) {
    apiError.value = typeof e === 'string' ? e : "Ошибка микрофона";
    lastResult.value = "incorrect";
  }
}

async function playCurrentWord() {
  if (currentWord.value && !isSpeaking.value) {
    await webSpeak(currentWord.value.hanzi);
  }
}

function reveal() { revealed.value = true; }
</script>

<template>
  <div class="flex min-h-screen flex-col items-center px-3 py-4 sm:px-4 sm:py-8">
    
    <div v-if="isModeSelect" class="w-full max-w-sm">
      <div class="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
        <BackButton />
        <h1 class="text-xl font-semibold text-foreground sm:text-2xl">Speaking</h1>
      </div>
      <p class="mb-4 text-xs text-muted-foreground sm:mb-6 sm:text-sm">Choose a practice mode.</p>
      <div class="grid grid-cols-2 gap-3">
        <Link v-for="mode in modes" :key="mode.title" :to="mode.to" class="block" :hover="true">
          <Card :title="mode.title" :description="mode.description" :icon="mode.icon" :tone="mode.tone" class="h-full" />
        </Link>
      </div>
    </div>

    <div v-else-if="isDictList" class="w-full max-w-xl">
      <div class="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
        <BackButton />
        <h1 class="text-xl font-semibold text-foreground sm:text-2xl">Words</h1>
      </div>
      <p class="mb-4 text-xs text-muted-foreground sm:mb-6 sm:text-sm">
        Select a dictionary to practise pronunciation.
      </p>
      <div class="grid gap-2 sm:gap-3 md:grid-cols-2">
        <Link v-for="dict in dictionaries" :key="dict.id" :to="`/speaking/words/${dict.id}`" class="block" :hover="true">
          <Card :title="dict.title" :description="`Practise ${dict.title} words`" :icon="dict.icon" :tone="dict.tone" class="h-full" />
        </Link>
      </div>
    </div>

    <div v-else-if="isSentences" class="w-full max-w-md flex flex-col gap-4">
      <div class="flex items-center gap-2 sm:gap-3">
        <BackButton />
        <h1 class="text-xl font-semibold text-foreground sm:text-2xl">AI Interview</h1>
      </div>
      
      <div class="flex-1 rounded-2xl border border-border bg-card p-4 min-h-[400px] flex flex-col justify-between">
        
        <div class="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          <div v-if="chatHistory.length === 0" class="text-center text-muted-foreground mt-10">
            Нажми микрофон и поздоровайся с профессором.
          </div>
          
          <div v-for="(msg, index) in chatHistory" :key="index" 
               class="flex flex-col max-w-[80%]"
               :class="msg.role === 'user' ? 'self-end items-end ml-auto' : 'self-start items-start'">
            <span class="text-xs text-muted-foreground mb-1 ml-1">{{ msg.role === 'user' ? 'You' : 'Professor' }}</span>
            <div class="px-4 py-2 rounded-2xl"
                 :class="msg.role === 'user' ? 'bg-accent text-white rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'">
              {{ msg.parts }}
            </div>
          </div>
          
          <div v-if="isChatLoading" class="self-start px-4 py-2 bg-muted rounded-2xl rounded-bl-sm flex items-center gap-2">
            <Icon icon="mdi:dots-horizontal" class="h-5 w-5 animate-pulse text-muted-foreground" />
          </div>
        </div>

        <p v-if="apiError" class="text-xs text-red-400 text-center mb-2">{{ apiError }}</p>

        <div class="flex justify-center mt-auto pt-4 border-t border-border/50">
            <button
              type="button"
              class="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-200 disabled:opacity-40"
              :class="{
                'scale-110 border-red-500 bg-red-500/20 text-red-400': isListening,
                'border-accent bg-accent/10 text-accent hover:bg-accent/20': !isListening,
              }"
              :disabled="isChatLoading || isSpeaking"
              @click="startConversation"
            >
              <Icon v-if="isListening" icon="lucide:square" class="h-6 w-6" />
              <Icon v-else icon="lucide:mic" class="h-7 w-7" />
            </button>
        </div>
        <p class="text-center text-xs text-muted-foreground mt-2">
          <span v-if="isListening">Говорите...</span>
          <span v-else-if="isChatLoading">Профессор думает...</span>
          <span v-else-if="isSpeaking">Профессор говорит...</span>
          <span v-else>Нажмите для ответа</span>
        </p>
      </div>
    </div>

    <div v-else-if="isPractice" class="flex w-full max-w-md flex-col gap-4">
      <div class="flex items-center gap-2 sm:gap-3">
        <BackButton />
        <h1 class="text-xl font-semibold text-foreground sm:text-2xl">{{ dictTitle }}</h1>
        <span class="ml-auto text-sm font-medium text-muted-foreground tabular-nums">{{ done ? queue.length : currentIndex + 1 }} / {{ queue.length }}</span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div class="h-full rounded-full bg-accent transition-all duration-300" :style="{ width: done ? '100%' : `${progress}%` }" />
      </div>

      <div v-if="done" class="flex flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-card p-10 text-center">
        <Icon :icon="score === queue.length ? 'lucide:star' : 'lucide:check-circle-2'" class="h-14 w-14 text-accent" />
        <p class="text-2xl font-semibold text-foreground">练习完成！</p>
        <p class="text-4xl font-bold text-foreground tabular-nums">{{ score }} <span class="text-2xl text-muted-foreground">/ {{ queue.length }}</span></p>
        <Button class="mt-2 px-6 py-2" @click="initQueue">Try again</Button>
      </div>

      <template v-else-if="currentWord">
        <div class="relative flex flex-col items-center gap-5 rounded-2xl border bg-card px-8 py-10 text-center shadow-sm transition-colors duration-300"
          :class="{'border-green-500/60 bg-green-500/5': lastResult === 'correct', 'border-red-500/60 bg-red-500/5': lastResult === 'incorrect', 'border-border': lastResult === null}">
          
          <div v-if="lastResult" class="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            :class="{'bg-green-500/20 text-green-400': lastResult === 'correct', 'bg-red-500/20 text-red-400': lastResult === 'incorrect'}">
            <Icon :icon="lastResult === 'correct' ? 'lucide:check' : 'lucide:x'" class="h-3 w-3" />
            {{ lastResult === "correct" ? "Correct" : "Incorrect" }}
          </div>
          <div class="absolute top-3 left-3 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">✓ {{ score }}</div>
          
          <p class="mt-4 text-7xl leading-none font-bold tracking-wider text-foreground sm:text-8xl">{{ currentWord.hanzi }}</p>
          <p class="text-xl font-medium tracking-widest text-accent sm:text-2xl">{{ currentWord.pinyin }}</p>
          
          <div class="min-h-6 w-full">
            <p v-if="revealed" class="text-base text-muted-foreground">{{ currentWord.translation }}</p>
            <button v-else type="button" class="text-sm text-muted-foreground underline-offset-2 hover:underline" @click="reveal">Show translation</button>
          </div>
          
          <p v-if="lastResult === 'incorrect'" class="text-xs text-red-400/90 italic">Heard: "{{ transcribedText || "(no transcription)" }}"</p>
          <p v-else-if="transcribedText && lastResult === 'correct'" class="text-xs text-muted-foreground italic">Heard: "{{ transcribedText }}"</p>
          <p v-if="apiError" class="mt-0.5 text-xs text-red-400">{{ apiError }}</p>
          
          <div class="mt-2 flex items-center gap-6">
            <button type="button" class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-foreground transition-colors hover:bg-muted/70 disabled:opacity-40"
              :disabled="isSpeaking" aria-label="Play pronunciation" @click="playCurrentWord">
              <Icon v-if="isSpeaking" icon="mdi:loading" class="h-5 w-5 animate-spin" />
              <Icon v-else icon="lucide:volume-2" class="h-5 w-5" />
            </button>
            <button type="button" class="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-200 disabled:opacity-40"
              :class="{'scale-110 border-red-500 bg-red-500/20 text-red-400': isListening, 'border-accent bg-accent/10 text-accent hover:bg-accent/20': !isListening, 'border-muted bg-muted text-muted-foreground': isSpeaking}"
              :disabled="isSpeaking" aria-label="Start recording" @click="checkWordPronunciation">
              <Icon v-if="isListening" icon="lucide:square" class="h-6 w-6" />
              <Icon v-else icon="lucide:mic" class="h-7 w-7" />
            </button>
          </div>
          
          <p class="-mt-1 text-xs text-muted-foreground">
            <template v-if="isListening">Listening...</template>
            <template v-else-if="lastResult">Moving to next word…</template>
            <template v-else>Tap 🎤 and say the word</template>
          </p>
        </div>
      </template>
    </div>
  </div>
</template>