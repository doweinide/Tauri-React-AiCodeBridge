/**
 * Language initialization utilities for detecting and applying the user's
 * preferred language at app startup.
 */
import { locale } from '@tauri-apps/plugin-os'
import i18n, { availableLanguages } from './config'
import { logger } from '@/lib/logger'

/**
 * Initialize the application language.
 *
 * Priority:
 * 1. User's saved language preference (if set)
 * 2. System locale if it is Chinese (`zh*`)
 * 3. Chinese (default)
 *
 * @param savedLanguage - The user's saved language preference from preferences
 */
export async function initializeLanguage(
  savedLanguage: string | null
): Promise<void> {
  try {
    if (savedLanguage) {
      if (availableLanguages.includes(savedLanguage)) {
        await i18n.changeLanguage(savedLanguage)
        logger.info('Language set from user preference', {
          language: savedLanguage,
        })
      } else {
        logger.warn('Saved language not available, using Chinese', {
          savedLanguage,
          availableLanguages,
        })
        await i18n.changeLanguage('zh')
      }
      return
    }

    const systemLocale = await locale()
    logger.debug('Detected system locale', { systemLocale })

    if (systemLocale) {
      const parts = systemLocale.split('-')
      const langCode = (parts[0] ?? 'zh').toLowerCase()

      // Product default is Chinese; only switch when system is zh*
      if (langCode.startsWith('zh') && availableLanguages.includes('zh')) {
        await i18n.changeLanguage('zh')
        logger.info('Language set to Chinese (default/system)', {
          systemLocale,
        })
        return
      }
    }

    await i18n.changeLanguage('zh')
    logger.info('Language set to Chinese (default)')
  } catch (error) {
    logger.error('Failed to initialize language', { error })
    await i18n.changeLanguage('zh')
  }
}
