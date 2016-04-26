# ssb-secret-blob

a simple script to encrypt a blob for secure scuttlebutt

## usage

```
# add a file to your local sbot, but encrypt it.
# a token comprised of the encrypted blob id,
# and the decryption key will be output.
# paste that into a private ssb message to send a private blob.

> sblob encrypt file.txt
{id#key}

# decrypt an encrypted blob.
# the token must be inside quotes, or bash won't parse it right.
# output will be contents of file.txt
> sblob decrypt "{id#key}"
```



## License

MIT

