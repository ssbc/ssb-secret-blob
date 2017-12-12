#! /usr/bin/env node

var path = require('path')
var BoxStream = require('pull-box-stream')
var File = require('pull-file')
var pull = require('pull-stream')
var toPull = require('stream-to-pull-stream')
//var Hash = require('pull-hash')
var crypto = require('crypto')
var zeros = new Buffer(24); zeros.fill(0)
var explain = require('explain-error')

function Hash (cb) {
  var hash = crypto.createHash('sha256')
  var buffers = []
  var hasher = pull.drain(function (data) {
    data = 'string' === typeof data ? new Buffer(data) : data
    buffers.push(data)
    hash.update(data)
  }, function (err) {
    cb(err, buffers, hash.digest())
  })
  return hasher
}

exports.box =
exports.encrypt =
  function (key) {
    return BoxStream.box(key, zeros)
  }

exports.unbox =
exports.decrypt =
  function (key) {
    return BoxStream.unbox(key, zeros)
  }

if(!module.parent) {
  var opts = require('minimist')(process.argv.slice(2))
  var cmd = opts._.shift()

  var blob = opts._.shift()

  require('ssb-client')(function (err, sbot) {
    if(err) throw err

    if(/^(encrypt|box)$/.test(cmd)) {
 
      //normally I would encourage stream users to always stream and
      //not buffer inbetween processing stages, but crypto is sometimes
      //an exception. here we need to hash something twice, first,
      //hash the plain text to use as the key. This has the benefit
      //of encrypting deterministically - the same file will have the same hash.
      //this can be used to deduplicate storage, but has privacy implications.

      //I do it here just because it's early days and this makes testing
      //easier.
      pull(File(blob), Hash(function (err, buffers, key) {
        if(err) throw err
        pull(
          pull.once(Buffer.concat(buffers)),
          BoxStream.createBoxStream(key, zeros),
          //get the hash of the blob to be added.
          //it would be better if muxrpc called back with the id,
          //but that isn't implemented yet.
          Hash(function (err, buffers, hash) {
            if(err) throw err
            var id = '&'+hash.toString('base64')+'.sha256'

            pull(
              pull.values(buffers), 
              sbot.blobs.add(id, function (err) {
                if(err) throw err
                sbot.blobs.push(id, function () {
                  console.log(id+'?unbox='+key.toString('base64'))
                  sbot.close()
                })
              })
            )

          })
        )
      }))
    }
    else if(/^(decrypt|unbox)$/.test(cmd)) {
      var id = blob.split('?')[0]
      var key = new Buffer(blob.split('?')[1].replace(/^unbox=/,''), 'base64')
      sbot.blobs.want(id, function (err, has) {
        if(err) throw err
        if(!has) {
          console.error('could not retrive blob:'+id)
          return sbot.close()
        }
        console.error('has:'+id)
        pull(
          sbot.blobs.get(id),
          BoxStream.createUnboxStream(key, zeros),
          toPull.sink(process.stdout, function (err) {
            if(err) throw explain(err, 'could not decrypt')
            sbot.close()
          })
        )
      })
    }
    else {
      sbot.close()
      console.error('USAGE:')
      console.error(' sblob box {file_name} # outputs blob_id+key')
      console.error(' sblob unbox {blob_id+key}')

    }
  })
}



