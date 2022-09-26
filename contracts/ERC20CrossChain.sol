// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9 <=0.9.0;
import "hardhat/console.sol";

import {IAxelarGateway} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol";
import {IAxelarGasService} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";
import {IERC20CrossChain} from "./IERC20CrossChain.sol";
import {ERC20} from "@axelar-network/axelar-cgp-solidity/contracts/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AxelarExecutable} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/executables/AxelarExecutable.sol";
import {Upgradable} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/upgradables/Upgradable.sol";
import {StringToAddress, AddressToString} from "@axelar-network/axelar-gmp-sdk-solidity/contracts/StringAddressUtils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

contract ERC20CrossChain is
    AxelarExecutable,
    ERC20,
    Upgradable,
    IERC20CrossChain
{
    using StringToAddress for string;
    using AddressToString for address;
    IERC20 public immutable underlying;
    string public underlyingNativeChain;
    bytes4 immutable _executeMintSig =
        bytes4(keccak256("_executeMint(address, uint256)"));
    bytes4 immutable _updatedBridgedAssetAccountingSig =
        bytes4(keccak256("_updateBridgedAssetAccounting(uint256)"));
    bytes4 immutable _bridgeAssetDiscrepancyTriggeredSig =
        bytes4(keccak256("_bridgeAssetDiscrepancyTriggered()"));

    bool public bridgeAssetDiscrepancy = false;
    error AlreadyInitialized();
    string[] axelarChains;
    event bridgeAssetDiscrepancyTriggered();
    event FalseSender(string sourceChain, string sourceAddress);

    using EnumerableMap for EnumerableMap.UintToUintMap;
    EnumerableMap.UintToUintMap private _bridgedUnderlyingBalances;

    IAxelarGasService public immutable gasReceiver;
    mapping(string => uint256) public chainNamesToIds;

    constructor(
        address gateway_,
        address gasReceiver_,
        uint8 decimals_,
        address underlying_,
        string memory underlyingNativeChain_
    ) AxelarExecutable(gateway_) ERC20("", "", decimals_) {
        gasReceiver = IAxelarGasService(gasReceiver_);
        underlying = IERC20(underlying_);
        underlyingNativeChain = underlyingNativeChain_;
    }

    function _setup(bytes calldata params) internal override {
        (string memory name_, string memory symbol_) = abi.decode(
            params,
            (string, string)
        );
        if (bytes(name).length != 0) revert AlreadyInitialized();
        name = name_;
        symbol = symbol_;
        underlyingNativeChain = "Ethereum";

        // chainNamesToIds["Ethereum"] = 1;
        // chainNamesToIds["Polygon"] = 137;
        // chainNamesToIds["Moonbeam"] = 1287;
        // chainNamesToIds["Avalanche"] = 43114;
        // chainNamesToIds["Fantom"] = 250;

        chainNamesToIds["Ethereum"] = 2502;
        chainNamesToIds["Polygon"] = 2503;
        chainNamesToIds["Moonbeam"] = 2500;
        chainNamesToIds["Avalanche"] = 2501;
        chainNamesToIds["Fantom"] = 2504;
        axelarChains = [
            // "Ethereum",
            // "Polygon",
            "Moonbeam"
            // "Fantom",
            "Avalanche"
        ];
    }

    // This is for testing.
    function giveMe(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function transferRemote(
        string calldata destinationChain,
        address destinationAddress,
        uint256 amount
    ) public payable override {
        _burn(msg.sender, amount);
        bytes memory payload = abi.encodeWithSignature(
            "_executeMint(address, uint256)",
            destinationAddress,
            amount
        );
        string memory stringAddress = address(this).toString();
        if (msg.value > 0) {
            gasReceiver.payNativeGasForContractCall{value: msg.value}(
                address(this),
                destinationChain,
                stringAddress,
                payload,
                msg.sender
            );
        }
        gateway.callContract(destinationChain, stringAddress, payload);
    }

    function updateBridgedAssetAccounting() public payable {
        bytes memory payload = abi.encodeWithSignature(
            "_updateBridgedAssetAccounting(uint256)",
            underlying.totalSupply()
        );
        string memory stringAddress = address(this).toString();
        if (msg.value > 0) {
            gasReceiver.payNativeGasForContractCall{value: msg.value}(
                address(this),
                underlyingNativeChain,
                stringAddress,
                payload,
                msg.sender
            );
        }
        gateway.callContract(
            underlyingNativeChain,
            address(this).toString(),
            payload
        );
    }

    function _updateBridgedAssetAccounting(
        string memory sourceChain,
        bytes calldata payload
    ) internal {
        if (compareStrings(sourceChain, underlyingNativeChain))
            revert("Only chains with bridged asset ");
        uint256 amount = abi.decode(payload, (uint256));
        uint256 chainId = chainNamesToIds[sourceChain];
        _bridgedUnderlyingBalances.set(chainId, amount);
    }

    function getBridgedUnderlyingBalance() public view returns (uint256) {
        uint256 totalBridgedSupply = 0;
        for (uint256 i = 0; i < _bridgedUnderlyingBalances.length(); i++) {
            (, uint256 supply) = _bridgedUnderlyingBalances.at(i);
            totalBridgedSupply += supply;
        }
        return totalBridgedSupply;
    }

    function _bridgeAssetDiscrepancyTriggered() internal {
        bridgeAssetDiscrepancy = true;
        _emergencyOffloadToxicAsset();
    }

    function triggerBridgeAssetDiscrepancy() public payable {
        require(
            block.chainid == chainNamesToIds[underlyingNativeChain],
            "Can be triggered only on the native chain"
        );
        require(!bridgeAssetDiscrepancy, "Bridge asset discrepancy already triggered");
        require(
            getBridgedUnderlyingBalance() >
                underlying.balanceOf(
                    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
                ),
            "No bridge asset balance discrepancy"
        );
        bridgeAssetDiscrepancy = true;

        emit bridgeAssetDiscrepancyTriggered();

        bytes memory payload = abi.encodeWithSignature(
            "_bridgeAssetDiscrepancyTriggered()"
        );
        string memory stringAddress = address(this).toString();

        axelarChains = [
            "Polygon",
            "Moonbeam",
            "Fantom",
            "Avalanche"
        ];
        for (uint256 i = 0; i < axelarChains.length; i++) {
            gasReceiver.payNativeGasForContractCall{value: 100000}(
                address(this),
                axelarChains[i],
                stringAddress,
                payload,
                msg.sender
            );

            gateway.callContract(
                axelarChains[i],
                stringAddress,
                payload
            );
        }
    }

    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        if (sourceAddress.toAddress() != address(this)) {
            emit FalseSender(sourceAddress, sourceAddress);
            return;
        }
        bytes calldata payloadNoSig = payload[4:];
        bytes4 sig = getSig(payload);
        if (getSig(payload) == _executeMintSig) {
            _executeMint(payloadNoSig);
        } else if (sig == _updatedBridgedAssetAccountingSig) {
            _updateBridgedAssetAccounting(sourceChain, payloadNoSig);
        } else if (sig == _bridgeAssetDiscrepancyTriggeredSig) {
            _bridgeAssetDiscrepancyTriggered();
        } else {
            revert("Invalid payload: no sig match");
        }
    }

    function getSig(bytes memory _data) private pure returns (bytes4 sig) {
        assembly {
            sig := mload(add(_data, 32))
        }
    }

    function _executeMint(bytes calldata payload) internal {
        (address to, uint256 amount) = abi.decode(payload, (address, uint256));
        _mint(to, amount);
    }

    function contractId() external pure returns (bytes32) {
        return keccak256("example");
    }

    // EMERGENCY

    function _emergencyOffloadToxicAsset() internal {
        if (!bridgeAssetDiscrepancy)
            revert("Oracle is not in a state of discrepancy");
        // router.swapExactTokensForTokens(
        //     underlying.balanceOf(address(this)),
        //     0,
        //     path,
        //     address(this),
        //     block.timestamp
        // );
    }

    // WRAPPED
    /**
     * @dev Allow a user to deposit underlying tokens and mint the corresponding number of wrapped tokens.
     */
    function depositFor(address account, uint256 amount) public returns (bool) {
        SafeERC20.safeTransferFrom(
            underlying,
            _msgSender(),
            address(this),
            amount
        );
        _mint(account, amount);
        return true;
    }

    /**
     * @dev Allow a user to burn a number of wrapped tokens and withdraw the corresponding number of underlying tokens.
     */
    function withdrawTo(address account, uint256 amount)
        public
        virtual
        returns (bool)
    {
        _burn(_msgSender(), amount);
        SafeERC20.safeTransfer(underlying, account, amount);
        return true;
    }

    /**
     * @dev Mint wrapped token to cover any underlyingTokens that would have been transferred by mistake. Internal
     * function that can be exposed with access control if desired.
     */
    function _recover(address account) internal virtual returns (uint256) {
        uint256 value = underlying.balanceOf(address(this)) - totalSupply;
        _mint(account, value);
        return value;
    }

    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    // UTILS
    // compare strings using keccak256
    function compareStrings(string memory a, string memory b)
        internal
        pure
        returns (bool)
    {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }
}
