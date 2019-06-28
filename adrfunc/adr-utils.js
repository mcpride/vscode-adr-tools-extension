const fs = require('fs')
const path = require('path')

const utils = require('../common/utils')

let dateOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
}

/**
 * Clean ADR name user input to make a filename
 * @param {String} adrName the ADR name typed by the user
 */
function sanitizedAdrName (adrName) {
  return adrName
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/'/, '-')
}

/**
 * return list of ADR files
 * @param {String} adrPath path where ADR are stored
 */
function getAllAdr (adrPath) {
  return utils.getADRFiles(adrPath)
}

/**
 * Return the last index
 * @param {String} adrPath Folder where are stored ADR
 */
function getLastIndex (adrPath) {
  var lastIndex = -1
  let files = utils.getADRFiles(adrPath)
  files.forEach(file => {
    var index = parseInt(file.split('-')[0])
    if (isNaN(index)) {
      index = 0
    }
    lastIndex = Math.max(lastIndex, index)
  })
  return lastIndex
}

/**
 * Create new ADR
 * @param {Object} adrAttr Object containing: srcAdrName, status, linkType, tgtAdrName
 * @param {String} srcAdrName Name of the ADR to create
 * @param {String} linkType link to add between 2 ADR if provided
 * @param {String} tgtAdrName filename of the ADR to link to
 * @param {String} adrPath Folder where to store ADR
 * @param {String} adrTemplatePath Folder where are stored ADR templates
 */
function createNewAdr (adrAttr, adrPath, adrTemplatePath) {
  const mustache = require('mustache')
  console.log(
    'create new adr ' + adrAttr.srcAdrName + ' in ' + adrPath + ' from templatepath ' + adrTemplatePath
  )
  let srcAdrSanitizeName = ''
  let lastIndex = getLastIndex(adrPath)
  lastIndex = '' + (lastIndex + 1)
  var data = ''
  let d = new Date()
  data = {
    date: d.toLocaleDateString('en-EN', dateOptions),
    status: '' + adrAttr.status + ' on ' + d.toLocaleDateString('en-EN', dateOptions),
    'adr-index': lastIndex,
    'adr-name': '' + adrAttr.srcAdrName + ''
  }
  srcAdrSanitizeName = lastIndex.padStart(4, '0') + '-' + sanitizedAdrName(adrAttr.srcAdrName) + '.md'

  if (adrAttr.linkType != null && adrAttr.tgtAdrName != null) {
    data['links'] = adrAttr.linkType + ' [' + adrAttr.tgtAdrName + '](' + adrAttr.tgtAdrName + ') on ' + d.toLocaleDateString('en-EN', dateOptions)
    let tgtFilePath = adrPath + path.sep + adrAttr.tgtAdrName
    let linkedType = adrAttr.linkType.replace(/s$/, 'ed by')
    if (adrAttr.linkType.trim().endsWith('es')) {
      linkedType = adrAttr.linkType.trim().replace(/es$/, 'ed by')
    }
    addLink(srcAdrSanitizeName, tgtFilePath, linkedType)
  }
  let templateContent = fs.readFileSync(adrTemplatePath + path.sep + 'index-recordname.md', 'utf8')

  let output = mustache.render(templateContent, data)
  fs.writeFileSync(adrPath + path.sep + srcAdrSanitizeName, output)
  return adrPath + path.sep + srcAdrSanitizeName
}

/**
 * change status of an adr
 * @param {String} adrFilename filename of the adr
 * @param {String} status new status
 */
function changeStatus (adrFilePath, status) {
  fs.readFile(adrFilePath, 'utf8', function (err, data) {
    if (err) {
      return console.log(err)
    }
    let d = new Date()
    var result = ''
    result = data.replace(
      /## Status([\s\S]+)Status: ([\w \t,]*)\s*/,
      '## Status$1Status: ' + status + ' on ' + d.toLocaleDateString('en-EN', dateOptions) + '\nPrevious status: $2  \n'
    )
    fs.writeFileSync(adrFilePath, result, 'utf8', function (err) {
      if (err) return console.log(err)
    })
  })
}

/**
 * add a relation between 2 ADR.
 * A special case for "supersed" relation:
 *  * it replace the current status instead of adding a new relation.
 * @param {String} srcAdrName adr source
 * @param {String} tgtFilePath file path of targeted adr
 * @param {String} linkType link type for linking the 2 ADR
 */
function addLink (srcAdrName, tgtFilePath, linkType) {
  console.log('add link ' + linkType + ' ' + srcAdrName + ' to ' + tgtFilePath)
  if (linkType === 'Superseded by') {
    changeStatus(tgtFilePath, 'Superseded')
  }
  let data = fs.readFileSync(tgtFilePath, 'utf8')
  let d = new Date()
  let result = data.replace(
    /## Status([\s\S]+)Status: ([\w ,\t]*)\s*/,
    '## Status$1Status: $2  \n' + linkType + ' [' + srcAdrName + '](' + srcAdrName + ') on ' + d.toLocaleDateString('en-EN', dateOptions) + '\n'
  )
  fs.writeFileSync(tgtFilePath, result, 'utf8')
}

function init (basedir, adrPath, adrTemplatePath, gitRepo) {
  const mustach = require('mustache')
  adrPath = path.join(basedir, adrPath)
  adrTemplatePath = path.join(basedir, adrTemplatePath)
  if (!fs.existsSync(adrPath)) {
    utils.mkDirByPathSync(adrPath)
  }
  if (!fs.existsSync(adrTemplatePath)) {
    utils.mkDirByPathSync(adrTemplatePath)

    const cp = require('child_process')
    cp.execSync('git clone ' + gitRepo + ' ' + adrTemplatePath, function (err, stdout, stderr) {
      if (err) {
        console.log('error while cloning adr template: ' + err)
      }
      console.log(`stdout: ${stdout}`)
      console.log(`stderr: ${stderr}`)
    })
  } else {
    const cp = require('child_process')
    cp.execSync('git reset --hard origin/master', { cwd: adrTemplatePath }, function (err, stdout, stderr) {
      if (err) {
        console.log('error while updating adr template: ' + err)
      }
      console.log(`stdout: ${stdout}`)
      console.log(`stderr: ${stderr}`)
    })
  }

  var data = ''
  let d = new Date()
  data = {
    date: d.toLocaleDateString('en-EN', dateOptions),
    status: 'Accepted on ' + d.toLocaleDateString('en-EN', dateOptions)
  }
  let output = mustach.render(
    fs.readFileSync(adrTemplatePath + path.sep + '0000-record-architecture-decisions.md', 'utf8'),
    data)
  fs.writeFileSync(adrPath + path.sep + '0000-record-architecture-decisions.md', output)
}

exports.init = init
exports.getAllAdr = getAllAdr
exports.createNewAdr = createNewAdr
exports.addLink = addLink
exports.changeStatus = changeStatus
