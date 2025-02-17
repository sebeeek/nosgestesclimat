/*
	Aggregates the model to an unique JSON file for each targeted language.

	Command: yarn compile:rules -- [options]
*/

import fs from 'fs'
import path from 'path'
import { exit } from 'process'
import Engine from 'publicodes'

import cli from './i18n/cli.js'
import utils, { publicDir, t9nDir } from './i18n/utils.js'

import { addRegionToBaseRules } from './i18n/addRegionToBaseRules.js'
import { addTranslationToBaseRules } from './i18n/addTranslationToBaseRules.js'

import { compressRules } from './modelOptim.mjs'
import {
	supportedRegionPath,
	supportedRegions,
	defaultModelCode,
	regionModelsPath,
	supportedRegionCodes,
} from './i18n/regionCommons.js'
import { getModelFromSource } from './getModelFromSource.js'

const { srcLang, srcFile, destLangs, destRegions, markdown } = cli.getArgs(
	`Aggregates the model to an unique JSON file.`,

	{
		source: true,
		target: true,
		model: { supportedRegionCodes },
		file: true,
		defaultSrcFile: 'data/**/*.yaml',
		markdown: true,
	}
)

/// ---------------------- Helper functions ----------------------

function writeSupportedRegions() {
	try {
		fs.writeFileSync(supportedRegionPath, JSON.stringify(supportedRegions))
		console.log(
			markdown
				? `| Supported regions | :heavy_check_mark: | Ø |`
				: ` ✅ The supported regions have been correctly written in: ${supportedRegionPath}`
		)
	} catch (err) {
		if (markdown) {
			console.log(
				`| Supported regions | ❌ | <details><summary>See error:</summary><br /><br /><code>${err}</code></details> |`
			)
		} else {
			console.log(
				' ❌ An error occured while writting rules in:',
				supportedRegionPath
			)
			console.log(err.message)
		}
		exit(-1)
	}
}

function writeRules(rules, path, destLang, regionCode) {
	try {
		fs.writeFileSync(path, JSON.stringify(rules))
		if (!markdown) {
			console.log(` ✅ The rules have been correctly written in: ${path}`)
		}
	} catch (err) {
		if (markdown) {
			console.log(
				`| Rules compilation to JSON for the region ${regionCode} in _${destLang}_ | ❌ | <details><summary>See error:</summary><br /><br /><code>${err}</code></details> |`
			)
		} else {
			console.log(' ❌ An error occured while writting rules in:', path)
			console.log(err.message)
		}
		exit(-1)
	}
}

function getTranslatedRules(baseRules, destLang) {
	if (destLang === srcLang) {
		return baseRules
	}
	const translatedAttrs =
		utils.readYAML(path.join(t9nDir, `translated-rules-${destLang}.yaml`)) ?? {}

	return addTranslationToBaseRules(baseRules, translatedAttrs)
}

function getLocalizedRules(translatedBaseRules, regionCode, destLang) {
	if (regionCode === defaultModelCode) {
		return translatedBaseRules
	}
	try {
		const localizedAttrs = utils.readYAML(
			path.join(regionModelsPath, `${regionCode}-${destLang}.yaml`)
		)
		return addRegionToBaseRules(translatedBaseRules, localizedAttrs)
	} catch (err) {
		cli.printWarn(`[SKIPPED] - ${regionCode}-${destLang} (${err.message})`)
		return addRegionToBaseRules(translatedBaseRules, {})
	}
}

/// ---------------------- Main ----------------------

if (markdown) {
	console.log('| Task | Status | Message |')
	console.log('|:-----|:------:|:-------:|')
}

writeSupportedRegions()

const baseRules = getModelFromSource(srcFile, ['data/i18n/**'], {
	verbose: !markdown,
})

try {
	new Engine(baseRules, {
		// NOTE(@EmileRolley): warnings are ignored for now but should be examined in
		//    https://github.com/datagir/nosgestesclimat/issues/1722
		logger: { log: (_) => {}, warn: (_) => {}, err: (s) => console.error(s) },
	})
	console.log(
		markdown
			? `| Rules evaluation | :heavy_check_mark: | Ø |`
			: ' ✅ Les règles ont été évaluées sans erreur !'
	)

	let correctlyCompiledAndOptimizedFiles = []

	destLangs.unshift(srcLang)
	destLangs.forEach((destLang) => {
		const translatedBaseRules = getTranslatedRules(baseRules, destLang)
		destRegions.forEach((regionCode) => {
			const localizedTranslatedBaseRules = getLocalizedRules(
				translatedBaseRules,
				regionCode,
				destLang
			)
			const destPathWithoutExtension = path.join(
				publicDir,
				`co2-model.${regionCode}-lang.${destLang}`
			)
			writeRules(
				localizedTranslatedBaseRules,
				destPathWithoutExtension + '.json',
				destLang,
				regionCode
			)
			compressRules(destPathWithoutExtension, destLang, markdown, regionCode)
			correctlyCompiledAndOptimizedFiles.push(
				'<li><b>' + `${regionCode}-${destLang}` + '</b></li>'
			)
		})
	})
	if (markdown) {
		console.log(
			`| Successfully compiled and optimized rules: <br><details><summary>Expand</summary> <ul>${correctlyCompiledAndOptimizedFiles.join(
				' '
			)}</ul></details> | :heavy_check_mark: | Ø |`
		)
	}
} catch (err) {
	if (markdown) {
		console.log(
			`| Rules evaluation | ❌ | <details><summary>See error:</summary><br /><br /><code>${err}</code></details> |`
		)
		console.log(err)
	} else {
		console.log(
			' ❌ Une erreur est survenue lors de la compilation des règles:\n'
		)
		let lines = err.message.split('\n')
		for (let i = 0; i < 9; ++i) {
			if (lines[i]) {
				console.log('  ', lines[i])
			}
		}
		console.log(err)
	}
}
