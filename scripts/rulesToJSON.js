/*
	Aggregates the model to an unique JSON file for each targeted language.

	Command: yarn compile:rules -- [options]
*/

const yaml = require('yaml')
const fs = require('fs')
const glob = require('glob')
const path = require('path')
const { exit } = require('process')
const Engine = require('publicodes').default

const utils = require('./i18n/utils')
const cli = require('./i18n/cli')

const outputJSONPath = './public'

const {
	addTranslationToBaseRules,
} = require('./i18n/addTranslationToBaseRules')

const { addRegionToBaseRules } = require('./i18n/addRegionToBaseRules')

const { srcLang, srcFile, destLangs, regions, markdown } = cli.getArgs(
	`Aggregates the model to an unique JSON file.`,

	{
		source: true,
		target: true,
		model: true,
		file: true,
		defaultSrcFile: 'data/**/*.yaml',
		markdown: true,
	}
)

const writeRules = (rules, path, destLang) => {
	fs.writeFile(path, JSON.stringify(rules), function (err) {
		if (err) {
			if (markdown) {
				console.log(
					`| Rules compilation to JSON for _${destLang}_ | ❌ | <details><summary>See error:</summary><br /><br /><code>${err}</code></details> |`
				)
			} else {
				console.log(' ❌ An error occured while writting rules in:', path)
				console.log(err.message)
			}
			exit(-1)
		}
		console.log(
			markdown
				? `| Rules compilation to JSON for _${destLang}_ | :heavy_check_mark: | Ø |`
				: ` ✅ The rules have been correctly written in JSON in: ${path}`
		)
	})
}

glob(srcFile, { ignore: ['data/i18n/**'] }, (_, files) => {
	const defaultDestPath = path.join(
		outputJSONPath,
		`co2-model.fr-lang.${srcLang}.json`
	)
	const baseRules = files.reduce((acc, filename) => {
		try {
			const rules = utils.readYAML(path.resolve(filename))
			return { ...acc, ...rules }
		} catch (err) {
			console.log(
				' ❌ Une erreur est survenue lors de la lecture du fichier',
				filename,
				':\n\n',
				err.message
			)
			exit(-1)
		}
	}, {})

	try {
		new Engine(baseRules).evaluate('bilan')

		if (markdown) {
			console.log('| Task | Status | Message |')
			console.log('|:-----|:------:|:-------:|')
		}
		console.log(
			markdown
				? `| Rules evaluation | :heavy_check_mark: | Ø |`
				: ' ✅ Les règles ont été évaluées sans erreur !'
		)

		writeRules(baseRules, defaultDestPath, srcLang)

		regions.forEach((region) => {
			const destPath = path.join(
				outputJSONPath,
				`co2-model.${region}-lang.fr.json`
			)
			const regionRuleAttrs =
				utils.readYAML(path.resolve(`data/i18n/models/${region}.yaml`)) ?? {}
			const rehydratedRules = addRegionToBaseRules(baseRules, regionRuleAttrs)
			writeRules(rehydratedRules, destPath, region)
		})

		destLangs.forEach((destLang) => {
			const destPath = path.join(
				outputJSONPath,
				`co2-model.fr-lang.${destLang}.json`
			)
			const translatedRuleAttrs =
				utils.readYAML(
					path.resolve(`data/i18n/t9n/translated-rules-${destLang}.yaml`)
				) ?? {}
			const translatedRules = addTranslationToBaseRules(
				baseRules,
				translatedRuleAttrs
			)
			writeRules(translatedRules, destPath, destLang)
			regions.forEach((region) => {
				const destPath = path.join(
					outputJSONPath,
					`co2-model.${region}-lang.${destLang}.json`
				)
				const regionRuleAttrs =
					utils.readYAML(
						path.resolve(`data/i18n/models/${region}-${destLang}.yaml`)
					) ?? {}
				const rehydratedRules = addRegionToBaseRules(
					translatedRules,
					regionRuleAttrs
				)
				writeRules(rehydratedRules, destPath, region)
			})
		})
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
			console.log()
		}
	}
})
