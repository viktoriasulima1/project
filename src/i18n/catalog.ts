import type { Locale } from './locales';
import type { MessageTree } from './translator';
import { FALLBACK_LOCALE } from './locales';

import enCommon from '../../messages/en-GB/common.json';
import enNavigation from '../../messages/en-GB/navigation.json';
import enValidation from '../../messages/en-GB/validation.json';
import enEnums from '../../messages/en-GB/enums.json';
import enErrors from '../../messages/en-GB/errors.json';
import enWorkOrders from '../../messages/en-GB/workOrders.json';
import enScouting from '../../messages/en-GB/scouting.json';
import enOnboarding from '../../messages/en-GB/onboarding.json';
import enFields from '../../messages/en-GB/fields.json';

import nlCommon from '../../messages/nl-NL/common.json';
import nlNavigation from '../../messages/nl-NL/navigation.json';
import nlValidation from '../../messages/nl-NL/validation.json';
import nlEnums from '../../messages/nl-NL/enums.json';
import nlErrors from '../../messages/nl-NL/errors.json';
import nlWorkOrders from '../../messages/nl-NL/workOrders.json';
import nlScouting from '../../messages/nl-NL/scouting.json';
import nlOnboarding from '../../messages/nl-NL/onboarding.json';
import nlFields from '../../messages/nl-NL/fields.json';

import plCommon from '../../messages/pl-PL/common.json';
import plNavigation from '../../messages/pl-PL/navigation.json';
import plValidation from '../../messages/pl-PL/validation.json';
import plEnums from '../../messages/pl-PL/enums.json';
import plErrors from '../../messages/pl-PL/errors.json';
import plWorkOrders from '../../messages/pl-PL/workOrders.json';
import plScouting from '../../messages/pl-PL/scouting.json';
import plOnboarding from '../../messages/pl-PL/onboarding.json';
import plFields from '../../messages/pl-PL/fields.json';

import deCommon from '../../messages/de-DE/common.json';
import deNavigation from '../../messages/de-DE/navigation.json';
import deValidation from '../../messages/de-DE/validation.json';
import deEnums from '../../messages/de-DE/enums.json';
import deErrors from '../../messages/de-DE/errors.json';
import deWorkOrders from '../../messages/de-DE/workOrders.json';
import deScouting from '../../messages/de-DE/scouting.json';
import deOnboarding from '../../messages/de-DE/onboarding.json';
import deFields from '../../messages/de-DE/fields.json';

/** Namespaces populated in this stage. New namespaces are added here + the four
 *  message folders; components then request them by name. */
export const NAMESPACES = ['common', 'navigation', 'validation', 'enums', 'errors', 'workOrders', 'scouting', 'onboarding', 'fields'] as const;
export type Namespace = (typeof NAMESPACES)[number];

type NamespaceMap = Record<Namespace, MessageTree>;

export const CATALOG: Record<Locale, NamespaceMap> = {
  'en-GB': { common: enCommon, navigation: enNavigation, validation: enValidation, enums: enEnums, errors: enErrors, workOrders: enWorkOrders, scouting: enScouting, onboarding: enOnboarding, fields: enFields },
  'nl-NL': { common: nlCommon, navigation: nlNavigation, validation: nlValidation, enums: nlEnums, errors: nlErrors, workOrders: nlWorkOrders, scouting: nlScouting, onboarding: nlOnboarding, fields: nlFields },
  'pl-PL': { common: plCommon, navigation: plNavigation, validation: plValidation, enums: plEnums, errors: plErrors, workOrders: plWorkOrders, scouting: plScouting, onboarding: plOnboarding, fields: plFields },
  'de-DE': { common: deCommon, navigation: deNavigation, validation: deValidation, enums: deEnums, errors: deErrors, workOrders: deWorkOrders, scouting: deScouting, onboarding: deOnboarding, fields: deFields },
} as unknown as Record<Locale, NamespaceMap>;

export function getNamespace(locale: Locale, namespace: Namespace): MessageTree {
  return CATALOG[locale][namespace];
}

/** Bundle only the namespaces a route needs (Part 8 — never ship everything). */
export function pickNamespaces(locale: Locale, namespaces: readonly Namespace[]) {
  const messages: Partial<Record<Namespace, MessageTree>> = {};
  const fallback: Partial<Record<Namespace, MessageTree>> = {};
  for (const ns of namespaces) {
    messages[ns] = CATALOG[locale][ns];
    fallback[ns] = CATALOG[FALLBACK_LOCALE][ns];
  }
  return { messages, fallback };
}
