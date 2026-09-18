<script setup lang="ts">
import type { EffectGroup } from '../../src/migrate/report'
import type { Fill, Fix, RenameQuestion } from '../../src/migrate/types'
import type { Review } from '../composables/useSchema'
import { computed } from 'vue'
import { collectionLabel, describeValue, entryCount, fillOptions, fixOptions, groupCount, groupEffects, groupTitle, questionText, renameHints } from '../../src/migrate/report'
import { questionKey, REMOVE } from '../composables/useSchema'
import ErrorAlert from './ErrorAlert.vue'

const props = defineProps<{
  review: Review | undefined
}>()

const SHOWN = 50

const effects = computed(() => props.review?.migration.value.effects ?? [])
const undecided = computed(() => props.review?.undecided.value.effects ?? [])

const removed = computed(() => groupEffects(effects.value, ['removed', 'lost']))
const unmatched = computed(() => groupEffects(undecided.value, ['unmatched']))
const missing = computed(() => groupEffects(undecided.value, ['missing'], false))
const invalid = computed(() => groupEffects(undecided.value, ['invalid'], false))
const created = computed(() => groupEffects(effects.value, ['created']))
const converted = computed(() => groupEffects(effects.value, ['converted'], false))
const questions = computed(() => props.review?.questions.value ?? [])
const blocked = computed(() => props.review?.migration.value.blocked.join('\n') ?? '')
const destructive = computed(() => removed.value.length > 0 || unmatched.value.some(group => create(group) === 'drop'))

function schemas() {
  return props.review ? [props.review.after, props.review.before] : []
}

function label(name: string): string {
  return collectionLabel(name, ...schemas())
}

function title(group: EffectGroup): string {
  return groupTitle(group, ...schemas())
}

function remaining(group: EffectGroup): number {
  return new Set(effects.value.filter(effect => effect.kind === group.kind && effect.collection === group.collection && effect.field === group.field).map(effect => effect.id)).size
}

function answers(question: RenameQuestion): { label: string, value: string }[] {
  return [
    ...question.to.map(target => ({ label: `Renamed to ${target}`, value: target })),
    { label: question.kind === 'collection' ? 'Removed, delete the entries' : 'Removed, drop the values', value: REMOVE },
  ]
}

function answer(question: RenameQuestion, value: unknown): void {
  props.review!.choices.answers[questionKey(question)] = String(value)
}

function options(group: EffectGroup) {
  return fillOptions(props.review!.after, group)
}

function fill(group: EffectGroup): Fill {
  return props.review?.choices.fills[group.collection]?.[group.field!] ?? { type: 'empty' }
}

function setFill(group: EffectGroup, next: Fill): void {
  const fills = props.review!.choices.fills[group.collection] ??= {}

  fills[group.field!] = next
}

function chooseFill(group: EffectGroup, type: unknown): void {
  const available = options(group)

  if (type === 'value')
    setFill(group, { type, value: '' })
  else if (type === 'locale')
    setFill(group, { type, locale: available.locales[0]!.value })
  else if (type === 'field')
    setFill(group, { type, field: available.fields[0]!.value })
  else if (type === 'slug')
    setFill(group, { type, field: available.texts[0]!.value })
  else
    setFill(group, { type: 'empty' })
}

function fix(group: EffectGroup): Fix {
  return props.review?.choices.fixes[group.collection]?.[group.field!] ?? 'keep'
}

function chooseFix(group: EffectGroup, value: unknown): void {
  const fixes = props.review!.choices.fixes[group.collection] ??= {}

  fixes[group.field!] = value as Fix
}

function create(group: EffectGroup): 'drop' | 'create' {
  return props.review?.choices.create[group.collection]?.includes(group.field!) ? 'create' : 'drop'
}

function chooseCreate(group: EffectGroup, value: unknown): void {
  const choices = props.review!.choices
  const kept = (choices.create[group.collection] ?? []).filter(field => field !== group.field)

  choices.create[group.collection] = value === 'create' ? [...kept, group.field!] : kept
}

function createItems(group: EffectGroup): { label: string, value: string }[] {
  const field = group.field === undefined ? undefined : props.review?.after.collections[group.collection]?.fields[group.field]
  const target = field?.type === 'relation' ? label(field.collection) : 'new'
  const texts = new Set(group.effects.map(effect => String(effect.before).trim().toLowerCase())).size

  return [
    { label: 'Leave the field empty', value: 'drop' },
    { label: `Create ${texts} ${target} ${texts === 1 ? 'entry' : 'entries'}`, value: 'create' },
  ]
}

const hints = computed(() => renameHints(props.review?.renames.value ?? {}))
</script>

<template>
  <UModal
    :open="!!review"
    title="Review the content changes"
    description="Check what happens to the content before the change is saved."
    :dismissible="!review?.saving.value"
    :ui="{ content: 'max-w-2xl', body: 'grid gap-6' }"
    @update:open="value => !value && review?.cancel()"
  >
    <template v-if="review" #body>
      <ErrorAlert title="This change would break content" :error="blocked" />

      <section v-if="questions.length" class="grid gap-3">
        <div class="grid gap-1">
          <h3 class="font-display text-base font-semibold text-highlighted">
            Renamed or removed?
          </h3>

          <p class="text-sm text-muted">
            Content still uses these names. Say what happened to them.
          </p>
        </div>

        <div
          v-for="question in questions"
          :key="questionKey(question)"
          class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center"
        >
          <p class="text-sm text-default">
            {{ questionText(question, ...schemas()) }}
          </p>

          <USelect
            :model-value="review.choices.answers[questionKey(question)] ?? ''"
            :items="answers(question)"
            placeholder="Choose"
            class="w-full"
            @update:model-value="answer(question, $event)"
          />
        </div>
      </section>

      <section v-if="removed.length" class="grid gap-3">
        <h3 class="font-display text-base font-semibold text-highlighted">
          Content that is removed
        </h3>

        <details v-for="group in removed" :key="group.key" class="rounded-md border border-default">
          <summary class="flex cursor-pointer flex-col gap-0.5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span class="min-w-0 font-medium wrap-anywhere text-highlighted">{{ title(group) }}</span>
            <span class="shrink-0 text-muted">{{ groupCount(group) }}</span>
          </summary>

          <ul class="divide-y divide-default border-t border-default text-sm">
            <li v-for="effect in group.effects.slice(0, SHOWN)" :key="`${effect.id}/${effect.locale}`" class="grid grid-cols-1 gap-x-3 px-3 py-1.5 sm:grid-cols-2">
              <span class="truncate">{{ effect.title }}</span>
              <span class="truncate text-muted">{{ effect.kind === 'removed' ? 'Deleted' : describeValue(effect.before) }}</span>
            </li>

            <li v-if="group.effects.length > SHOWN" class="px-3 py-1.5 text-muted">
              and {{ group.effects.length - SHOWN }} more
            </li>
          </ul>
        </details>
      </section>

      <section v-if="unmatched.length" class="grid gap-3">
        <div class="grid gap-1">
          <h3 class="font-display text-base font-semibold text-highlighted">
            Text without a matching entry
          </h3>

          <p class="text-sm text-muted">
            Text becomes a link to the entry with that title. These have none.
          </p>
        </div>

        <div v-for="group in unmatched" :key="group.key" class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
          <div class="grid min-w-0 gap-0.5 text-sm">
            <span class="font-medium wrap-anywhere text-highlighted">{{ title(group) }}</span>
            <span class="truncate text-muted">{{ [...new Set(group.effects.map(effect => describeValue(effect.before)))].join(', ') }}</span>
          </div>

          <USelect :model-value="create(group)" :items="createItems(group)" class="w-full" @update:model-value="chooseCreate(group, $event)" />
        </div>
      </section>

      <section v-if="missing.length" class="grid gap-3">
        <div class="grid gap-1">
          <h3 class="font-display text-base font-semibold text-highlighted">
            Values that are needed
          </h3>

          <p class="text-sm text-muted">
            These fields are required. Entries left empty stay in the editor, but the site doesn't build until they're filled in.
          </p>
        </div>

        <div v-for="group in missing" :key="group.key" class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-start">
          <div class="grid min-w-0 gap-0.5 pt-1.5 text-sm">
            <span class="font-medium wrap-anywhere text-highlighted">{{ title(group) }}</span>
            <span class="text-muted">
              {{ entryCount(group.entries) }}<template v-if="fill(group).type !== 'empty'">, {{ remaining(group) ? `${remaining(group)} still empty` : 'all filled' }}</template>
            </span>
          </div>

          <div class="grid gap-2">
            <USelect :model-value="fill(group).type" :items="options(group).types" class="w-full" @update:model-value="chooseFill(group, $event)" />

            <UInput
              v-if="fill(group).type === 'value'"
              :model-value="String((fill(group) as { value: string }).value)"
              placeholder="Value"
              class="w-full"
              @update:model-value="setFill(group, { type: 'value', value: String($event) })"
            />

            <USelect
              v-else-if="fill(group).type === 'field' || fill(group).type === 'slug'"
              :model-value="(fill(group) as { field: string }).field"
              :items="fill(group).type === 'slug' ? options(group).texts : options(group).fields"
              class="w-full"
              @update:model-value="setFill(group, { type: fill(group).type as 'field', field: String($event) })"
            />

            <USelect
              v-else-if="fill(group).type === 'locale'"
              :model-value="(fill(group) as { locale: string }).locale"
              :items="options(group).locales"
              class="w-full"
              @update:model-value="setFill(group, { type: 'locale', locale: String($event) })"
            />
          </div>
        </div>
      </section>

      <section v-if="invalid.length" class="grid gap-3">
        <div class="grid gap-1">
          <h3 class="font-display text-base font-semibold text-highlighted">
            Values that break the new rules
          </h3>

          <p class="text-sm text-muted">
            The site doesn't build while values break a field's rules.
          </p>
        </div>

        <div v-for="group in invalid" :key="group.key" class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-center">
          <div class="grid min-w-0 gap-0.5 text-sm">
            <span class="font-medium wrap-anywhere text-highlighted">{{ title(group) }}</span>
            <span class="truncate text-muted">{{ entryCount(group.entries) }}: {{ group.effects[0]?.message }}<template v-if="fix(group) !== 'keep'">, {{ remaining(group) ? `${remaining(group)} still break it` : 'all fixed' }}</template></span>
          </div>

          <USelect :model-value="fix(group)" :items="fixOptions(review.after, group)" class="w-full" @update:model-value="chooseFix(group, $event)" />
        </div>
      </section>

      <section v-if="created.length" class="grid gap-2">
        <h3 class="font-display text-base font-semibold text-highlighted">
          New entries
        </h3>

        <p v-for="group in created" :key="group.key" class="text-sm text-muted">
          <span class="font-medium text-highlighted">{{ label(group.collection) }}:</span>
          {{ group.effects.map(effect => effect.title).join(', ') }}
        </p>
      </section>

      <section v-if="converted.length" class="grid gap-2">
        <h3 class="font-display text-base font-semibold text-highlighted">
          Changed without losing anything
        </h3>

        <p v-for="group in converted" :key="group.key" class="flex justify-between gap-3 text-sm">
          <span class="min-w-0 wrap-anywhere text-default">{{ title(group) }}</span>
          <span class="shrink-0 text-muted">{{ entryCount(group.entries) }}</span>
        </p>
      </section>

      <UAlert
        v-if="hints.length"
        color="neutral"
        variant="subtle"
        icon="i-hugeicons-information-circle"
        title="Update the code that uses the old names"
      >
        <template #description>
          <ul class="mt-1 grid gap-0.5 font-mono text-xs">
            <li v-for="hint in hints" :key="hint">
              {{ hint }}
            </li>
          </ul>
        </template>
      </UAlert>

      <ErrorAlert title="The change could not be saved" :error="review.error.value" />
    </template>

    <template v-if="review" #footer>
      <UButton
        :label="destructive ? 'Save and remove content' : 'Save'"
        :color="destructive ? 'error' : 'primary'"
        :loading="review.saving.value"
        :disabled="!review.ready.value"
        @click="review.apply()"
      />

      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="review.saving.value" @click="review.cancel()" />
    </template>
  </UModal>
</template>
