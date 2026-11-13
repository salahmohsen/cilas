'use client'

import { FieldDescription, FieldLabel, useField } from '@payloadcms/ui'
import type { SelectFieldClientProps } from 'payload'

import { HERO_SCENES, type HeroScene } from '@/lib/hero-scenes'
import styles from './hero-scene-picker.module.css'

/** The hero's scene as a choice of two pictures, each a radio button. */
export function HeroScenePicker({ path, field, readOnly }: SelectFieldClientProps) {
  const { value, setValue } = useField<HeroScene>({ path })
  const chosen = value ?? HERO_SCENES[0].value
  const description = typeof field.admin?.description === 'string' ? field.admin.description : ''

  return (
    <fieldset className={styles.picker}>
      <legend>
        <FieldLabel as="span" label="Scene" path={path} required={field.required} />
      </legend>
      <div className={styles.options}>
        {HERO_SCENES.map((scene) => (
          <label className={styles.option} key={scene.value}>
            <input
              checked={chosen === scene.value}
              disabled={readOnly}
              name={path}
              onChange={() => setValue(scene.value)}
              type="radio"
              value={scene.value}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- a static admin picture */}
            <img alt="" height={450} src={scene.preview} width={800} />
            <span className={styles.label}>
              {scene.label}
              {scene.value === HERO_SCENES[0].value ? (
                <span className={styles.note}> (default)</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {description ? <FieldDescription description={description} path={path} /> : null}
    </fieldset>
  )
}
