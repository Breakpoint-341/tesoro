import type { NextPage } from 'next'
import { useState, KeyboardEventHandler, ChangeEventHandler, FocusEventHandler, useEffect, useContext } from 'react'
import { Hero, Layout, Panel } from '../../components/layout'
import { getResult, useCardanoMultiplatformLib } from '../../cardano/multiplatform-lib'
import type { Cardano, MultiSigType } from '../../cardano/multiplatform-lib'
import { Loading } from '../../components/status'
import type { NativeScript } from '@dcspark/cardano-multiplatform-lib-browser'
import { PlusIcon, TrashIcon } from '@heroicons/react/solid'
import { isAddressNetworkCorrect, SaveTreasuryButton } from '../../components/transaction'
import { NotificationContext } from '../../components/notification'
import { ConfigContext } from '../../cardano/config'

const AddAddress: NextPage<{
  cardano: Cardano
  onAdd: (address: string) => void
}> = ({ cardano, onAdd }) => {
  const [address, setAddress] = useState('')
  const [config, _] = useContext(ConfigContext)

  const result = getResult(() => {
    const addressObject = cardano.lib.Address.from_bech32(address)
    if (!isAddressNetworkCorrect(config, addressObject)) throw new Error('Wrong network')
    return addressObject.as_base()?.payment_cred().to_keyhash()
  })

  const isValid = result.isOk && !!result.data

  const submit = () => {
    if (isValid) {
      onAdd(address)
      setAddress('')
    }
  }

  const enterPressHandle: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.shiftKey == false && event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  return (
    <label className='block space-y-1'>
      <div>Firmantes (mínimo 2)</div>
      <div className='flex space-x-2 items-start'>
        <textarea
          className={['block w-full border p-2 rounded', isValid ? '' : 'text-red-500'].join(' ')}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={enterPressHandle}
          rows={1}
          value={address}
          placeholder="Copia aquí la dirección del firmante y presiona 'Agregar'">
        </textarea>
        <button
          disabled={!isValid}
          onClick={submit}
          className='flex p-2 items-center space-x-1 border rounded text-sky-700 disabled:text-gray-400'>
          <PlusIcon className='h-4' />
          <span>Agregar</span>
        </button>
      </div>
    </label>
  )
}

const RequiredNumberInput: NextPage<{
  className?: string
  max: number
  required: number
  onCommit: (_: number) => void
}> = ({ className, required, max, onCommit }) => {
  const [value, setValue] = useState(required.toString())

  const changeHandle: ChangeEventHandler<HTMLInputElement> = (event) => {
    const value = event.target.value
    setValue(value)
  }

  const blurHandle: FocusEventHandler<HTMLInputElement> = () => {
    const parsedValue = parse(value)
    onCommit(parsedValue)
  }

  useEffect(() => {
    let isMounted = true

    isMounted && setValue(required.toString())

    return () => {
      isMounted = false
    }
  }, [required])

  function parse(input: string): number {
    const parsedValue = parseInt(input)

    if (isNaN(parsedValue)) return 1
    if (parsedValue < 1) return 1
    if (parsedValue > max) return max
    return parsedValue
  }

  return (
    <input type='number'
      className={className}
      value={value}
      step={1}
      min={1}
      max={max}
      onBlur={blurHandle}
      onChange={changeHandle} />
  )
}

type KeyHashMap = Map<string, string>

const KeyHashList: NextPage<{
  className?: string
  keyHashMap: KeyHashMap
  deleteKeyHash: (keyHashHex: string) => void
}> = ({ className, keyHashMap, deleteKeyHash }) => {
  if (keyHashMap.size <= 0) return null

  return (
    <div className={className}>
      <div>Signers</div>
      <ul className='border divide-y rounded'>
        {Array.from(keyHashMap).map(([keyHashHex, address]) => {
          return (
            <li key={keyHashHex} className='flex items-center p-2'>
              <div className='grow'>
                <div>{address}</div>
                <div>{keyHashHex}</div>
              </div>
              <button className='p-2'>
                <TrashIcon className='w-4' onClick={() => deleteKeyHash(keyHashHex)} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const NewTreasury: NextPage = () => {
  const [keyHashMap, setKeyHashMap] = useState<KeyHashMap>(new Map())
  const [scriptType, setScriptType] = useState<MultiSigType>('all')
  const [required, setRequired] = useState(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [config, _] = useContext(ConfigContext)
  const { notify } = useContext(NotificationContext)
  const cardano = useCardanoMultiplatformLib()
  if (!cardano) return <Loading />;

  const getScript = (): NativeScript | undefined => {
    if (keyHashMap.size <= 1) return
    const keyHashes = Array
      .from(keyHashMap.keys())
      .map((keyHashHex) => cardano.lib.Ed25519KeyHash.from_hex(keyHashHex))
    return cardano.buildMultiSigScript(keyHashes, scriptType, required)
  }

  const addAddress = (address: string) => {
    const result = getResult(() => {
      const addressObject = cardano.lib.Address.from_bech32(address)
      if (!isAddressNetworkCorrect(config, addressObject)) throw new Error('Wrong network')
      return cardano.lib.Address.from_bech32(address).as_base()?.payment_cred().to_keyhash()
    })
    if (result.isOk && result.data) {
      setKeyHashMap(new Map(keyHashMap).set(result.data.to_hex(), address))
      return
    }
    notify('error', 'Invalid address.')
  }

  const deleteKeyHash = (keyHashHex: string) => {
    const newMap = new Map(keyHashMap)
    newMap.delete(keyHashHex)
    setKeyHashMap(newMap)
  }

  return (
    <Layout>
      <div className='space-y-2'>
        <Hero>
          <h1 className='font-semibold text-lg'>Crear Tesoro Multisig</h1>
          <p>El Tesoro quedará protegido a través de un script.</p>
          <p>Un Tesoro necesita más de una dirección (addr1).</p>
          <p>Por favor, utilizar únicamente direcciones de recepción y que no pertenezcan a un Exchange.</p>
        </Hero>
        <Panel>
          <div className='p-4 space-y-4'>
            <label className='block space-y-1'>
              <div className="after:content-['*'] after:text-red-500">Nombre del Tesoro</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='p-2 block border w-full rounded'
                placeholder='Escribe un nombre' />
            </label>
            <label className='block space-y-1'>
              <div>Descripción</div>
              <textarea
                className='p-2 block border w-full rounded'
                placeholder='Describe este Tesoro'
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}>
              </textarea>
            </label>
            <KeyHashList className='space-y-1' keyHashMap={keyHashMap} deleteKeyHash={deleteKeyHash} />
            {keyHashMap.size > 1 &&
              <div className='space-y-1'>
                <div>Required Signers</div>
                <div className='flex space-x-2 items-center'>
                  <select className='bg-white border rounded text-sm p-2' onChange={(e) => setScriptType(e.target.value as MultiSigType)}>
                    <option value="all">All</option>
                    <option value="any">Any</option>
                    <option value="atLeast">At least</option>
                  </select>
                  {scriptType == 'atLeast' &&
                    <RequiredNumberInput
                      className='border rounded p-1'
                      max={keyHashMap.size}
                      required={required}
                      onCommit={setRequired} />
                  }
                  <div className='p-2 space-x-1'>
                    <span>of</span>
                    <span>{keyHashMap.size}</span>
                  </div>
                </div>
              </div>}
            <hr />
            <AddAddress cardano={cardano} onAdd={addAddress} />
          </div>
          <footer className='flex justify-end p-4 bg-gray-100'>
            <SaveTreasuryButton
              cardano={cardano}
              className='px-4 py-2 bg-sky-700 text-white rounded disabled:border disabled:text-gray-400 disabled:bg-gray-100'
              name={name}
              description={description}
              script={getScript()}>
              Crear Tesoro
            </SaveTreasuryButton>
          </footer>
        </Panel>
      </div>
    </Layout>
  )
}

export default NewTreasury
