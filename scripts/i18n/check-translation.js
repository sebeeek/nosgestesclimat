/*
	Checks all rules have been translated.

	Command: yarn check:rules -- [options]
*/

const path = require('path')
const glob = require('glob')
const R = require('ramda')
const { exit } = require('process')

const cli = require('./cli')
const utils = require('./utils')

const { destLangs, srcFile, markdown } = cli.getArgs(
	`Checks all rules have been translated.`,
	{
		source: true,
		target: true,
		file: true,
		markdown: true,
		defaultSrcFile: 'data/**/*.yaml',
	}
)

function manageNotUpToDateRuleTranslations(
	notUpToDateTranslationRules,
	destPath,
	destRules
) {
	let removed = false
	console.log(
		`⚠️ There are ${cli.yellow(
			notUpToDateTranslationRules.length
		)} not up-to-date rule translations:`
	)
	if (cli.promptYesNo(`Do you want to remove them?`)) {
		notUpToDateTranslationRules.forEach((rule) => {
			if (
				cli.promptYesNo(
					`Do you want to remove ${cli.styledRuleNameWithOptionalAttr(rule)}?`
				)
			) {
				removed = true
				delete destRules[rule]
			}
		})
		if (removed) {
			console.log(`Writing updated rules translations to: ${destPath}`)
			utils.writeYAML(destPath, destRules)
		}
	}
}

glob(`${srcFile}`, { ignore: ['data/i18n/**'] }, (_, files) => {
	const rules = R.mergeAll(
		files.reduce((acc, filename) => {
			try {
				return acc.concat(utils.readYAML(filename))
			} catch (err) {
				cli.printErr('An error occured while reading the file ' + filename + '')
				cli.printErr(err)
				exit(-1)
			}
		}, [])
	)

	cli.printChecksResultTableHeader(markdown)

	destLangs.forEach((destLang) => {
		const destPath = `data/i18n/t9n/translated-rules-${destLang}.yaml`
		const destRules = R.mergeAll(utils.readYAML(path.resolve(destPath)))
		const missingRules = utils.getMissingRules(rules, destRules)
		const missingRuleNames = missingRules.map(
			(obj) => `${obj.rule} -> ${obj.attr}`
		)
		const nbMissing = missingRules.length

		cli.printChecksResult(
			nbMissing,
			missingRuleNames,
			'rules',
			destLang,
			markdown
		)
		if (nbMissing > 0 && cli.promptYesNo(`Do you want to log missing rules?`)) {
			missingRules.map(({ rule: ruleName, attr }) =>
				console.log(cli.styledRuleNameWithOptionalAttr(ruleName, attr))
			)
		}

		const notUpToDateRuleTranslations = utils.getNotUpToDateRuleTranslations(
			rules,
			destRules
		)
		if (!markdown && notUpToDateRuleTranslations.length > 0) {
			manageNotUpToDateRuleTranslations(
				notUpToDateRuleTranslations,
				destPath,
				destRules
			)
		}
	})
})
