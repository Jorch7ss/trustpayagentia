// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustPayRegistry
 * @notice Registro verificable de pagos empresariales en Arbitrum.
 *         Almacena facturas, verifica pagos y guarda reportes de riesgo
 *         como hashes — los datos sensibles nunca salen del entorno local.
 * @dev    Desplegado en Arbitrum One / Arbitrum Sepolia (testnet).
 */
contract TrustPayRegistry {

    // ─────────────────────────────────────────────
    //  ENUMS
    // ─────────────────────────────────────────────

    enum InvoiceStatus { PENDING, ACCEPTED, REVIEW, REJECTED }
    enum RiskLevel    { LOW, MEDIUM, HIGH }

    // ─────────────────────────────────────────────
    //  STRUCTS
    // ─────────────────────────────────────────────

    struct Invoice {
        string   invoiceId;        // "F-1029"
        address  merchantWallet;   // wallet oficial de la empresa receptora
        uint256  expectedAmount;   // en unidades del token (ej. USDC tiene 6 decimales)
        address  acceptedToken;    // dirección del token esperado (USDC, MXNB, etc.)
        uint64   createdAt;        // timestamp de registro
        InvoiceStatus status;
        bool     exists;
    }

    struct PaymentRecord {
        string   invoiceId;
        bytes32  txHash;           // hash de la tx en Arbitrum
        address  payerWallet;      // wallet que originó el pago
        uint256  paidAmount;
        address  tokenUsed;
        uint8    riskScore;        // 0–100
        RiskLevel riskLevel;
        bytes32  reportHash;       // keccak256 del reporte completo (off-chain)
        uint64   verifiedAt;
        InvoiceStatus verdict;
    }

    struct MerchantProfile {
        string  name;
        address wallet;
        bool    active;
        uint64  registeredAt;
    }

    // ─────────────────────────────────────────────
    //  STORAGE
    // ─────────────────────────────────────────────

    address public owner;

    // invoiceId  → Invoice
    mapping(string => Invoice) private invoices;

    // invoiceId  → PaymentRecord (un pago verificado por factura)
    mapping(string => PaymentRecord) private payments;

    // wallet → está en allowlist
    mapping(address => bool) public allowlist;

    // wallet → está en blacklist
    mapping(address => bool) public blacklist;

    // merchant wallet → perfil
    mapping(address => MerchantProfile) public merchants;

    // lista de invoiceIds registrados (para iterar en demo)
    string[] private invoiceIds;

    // ─────────────────────────────────────────────
    //  EVENTS
    // ─────────────────────────────────────────────

    event InvoiceRegistered(
        string indexed invoiceId,
        address indexed merchantWallet,
        uint256 expectedAmount,
        address acceptedToken
    );

    event PaymentVerified(
        string indexed invoiceId,
        bytes32 indexed txHash,
        address indexed payerWallet,
        uint8   riskScore,
        InvoiceStatus verdict
    );

    event WalletAllowlisted(address indexed wallet);
    event WalletBlacklisted(address indexed wallet);
    event MerchantRegistered(address indexed wallet, string name);

    // ─────────────────────────────────────────────
    //  MODIFIERS
    // ─────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "TrustPay: not owner");
        _;
    }

    modifier invoiceExists(string calldata invoiceId) {
        require(invoices[invoiceId].exists, "TrustPay: invoice not found");
        _;
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTOR
    // ─────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─────────────────────────────────────────────
    //  MERCHANT MANAGEMENT
    // ─────────────────────────────────────────────

    /**
     * @notice Registra una empresa con su wallet oficial.
     */
    function registerMerchant(address wallet, string calldata name) external onlyOwner {
        require(wallet != address(0), "TrustPay: zero address");
        merchants[wallet] = MerchantProfile({
            name: name,
            wallet: wallet,
            active: true,
            registeredAt: uint64(block.timestamp)
        });
        // La wallet del merchant entra automáticamente a la allowlist
        allowlist[wallet] = true;
        emit MerchantRegistered(wallet, name);
    }

    // ─────────────────────────────────────────────
    //  INVOICE MANAGEMENT
    // ─────────────────────────────────────────────

    /**
     * @notice Registra una factura con los parámetros de pago esperados.
     * @param invoiceId      Identificador único, ej. "F-1029"
     * @param merchantWallet Wallet oficial de la empresa que debe recibir el pago
     * @param expectedAmount Monto exacto esperado (en unidades base del token)
     * @param acceptedToken  Dirección del token aceptado
     */
    function registerInvoice(
        string    calldata invoiceId,
        address            merchantWallet,
        uint256            expectedAmount,
        address            acceptedToken
    ) external onlyOwner {
        require(!invoices[invoiceId].exists,  "TrustPay: invoice already exists");
        require(merchantWallet != address(0), "TrustPay: zero merchant wallet");
        require(expectedAmount > 0,           "TrustPay: amount must be > 0");

        invoices[invoiceId] = Invoice({
            invoiceId:      invoiceId,
            merchantWallet: merchantWallet,
            expectedAmount: expectedAmount,
            acceptedToken:  acceptedToken,
            createdAt:      uint64(block.timestamp),
            status:         InvoiceStatus.PENDING,
            exists:         true
        });

        invoiceIds.push(invoiceId);
        emit InvoiceRegistered(invoiceId, merchantWallet, expectedAmount, acceptedToken);
    }

    // ─────────────────────────────────────────────
    //  PAYMENT VERIFICATION
    // ─────────────────────────────────────────────

    /**
     * @notice Registra el resultado de una verificación de pago.
     *         El motor de riesgo corre off-chain (local); aquí sólo
     *         se graba el veredicto y el hash del reporte completo.
     *
     * @param invoiceId   Factura asociada
     * @param txHash      Hash de la transacción verificada en Arbitrum
     * @param payerWallet Wallet que originó el pago
     * @param paidAmount  Monto efectivamente pagado
     * @param tokenUsed   Token usado en el pago
     * @param riskScore   Puntaje 0–100 calculado off-chain
     * @param reportHash  keccak256 del JSON completo del reporte (privacidad)
     */
    function verifyPayment(
        string   calldata invoiceId,
        bytes32           txHash,
        address           payerWallet,
        uint256           paidAmount,
        address           tokenUsed,
        uint8             riskScore,
        bytes32           reportHash
    ) external onlyOwner invoiceExists(invoiceId) {
        require(riskScore <= 100, "TrustPay: invalid risk score");
        require(
            invoices[invoiceId].status == InvoiceStatus.PENDING,
            "TrustPay: invoice already processed"
        );

        // Calcular veredicto según el score
        InvoiceStatus verdict;
        RiskLevel     level;

        if (riskScore <= 30) {
            verdict = InvoiceStatus.ACCEPTED;
            level   = RiskLevel.LOW;
        } else if (riskScore <= 70) {
            verdict = InvoiceStatus.REVIEW;
            level   = RiskLevel.MEDIUM;
        } else {
            verdict = InvoiceStatus.REJECTED;
            level   = RiskLevel.HIGH;
        }

        // Guardar el registro
        payments[invoiceId] = PaymentRecord({
            invoiceId:   invoiceId,
            txHash:      txHash,
            payerWallet: payerWallet,
            paidAmount:  paidAmount,
            tokenUsed:   tokenUsed,
            riskScore:   riskScore,
            riskLevel:   level,
            reportHash:  reportHash,
            verifiedAt:  uint64(block.timestamp),
            verdict:     verdict
        });

        // Actualizar estado de la factura
        invoices[invoiceId].status = verdict;

        emit PaymentVerified(invoiceId, txHash, payerWallet, riskScore, verdict);
    }

    // ─────────────────────────────────────────────
    //  ALLOWLIST / BLACKLIST
    // ─────────────────────────────────────────────

    function addToAllowlist(address wallet) external onlyOwner {
        require(!blacklist[wallet], "TrustPay: wallet is blacklisted");
        allowlist[wallet] = true;
        emit WalletAllowlisted(wallet);
    }

    function addToBlacklist(address wallet) external onlyOwner {
        allowlist[wallet] = false;
        blacklist[wallet] = true;
        emit WalletBlacklisted(wallet);
    }

    function removeFromAllowlist(address wallet) external onlyOwner {
        allowlist[wallet] = false;
    }

    function removeFromBlacklist(address wallet) external onlyOwner {
        blacklist[wallet] = false;
    }

    // ─────────────────────────────────────────────
    //  VIEWS — consultas públicas sin datos sensibles
    // ─────────────────────────────────────────────

    function getInvoice(string calldata invoiceId)
        external view invoiceExists(invoiceId)
        returns (
            address merchantWallet,
            uint256 expectedAmount,
            address acceptedToken,
            uint64  createdAt,
            InvoiceStatus status
        )
    {
        Invoice storage inv = invoices[invoiceId];
        return (
            inv.merchantWallet,
            inv.expectedAmount,
            inv.acceptedToken,
            inv.createdAt,
            inv.status
        );
    }

    function getPaymentRecord(string calldata invoiceId)
        external view invoiceExists(invoiceId)
        returns (
            bytes32       txHash,
            address       payerWallet,
            uint256       paidAmount,
            uint8         riskScore,
            RiskLevel     riskLevel,
            bytes32       reportHash,
            uint64        verifiedAt,
            InvoiceStatus verdict
        )
    {
        PaymentRecord storage p = payments[invoiceId];
        return (
            p.txHash,
            p.payerWallet,
            p.paidAmount,
            p.riskScore,
            p.riskLevel,
            p.reportHash,
            p.verifiedAt,
            p.verdict
        );
    }

    /**
     * @notice Verifica si el reporte local no fue alterado.
     *         Recibe el JSON del reporte, lo hashea y compara con lo guardado.
     */
    function verifyReportIntegrity(
        string calldata invoiceId,
        bytes  calldata reportJson
    ) external view invoiceExists(invoiceId) returns (bool valid) {
        bytes32 computedHash = keccak256(reportJson);
        return computedHash == payments[invoiceId].reportHash;
    }

    function getInvoiceCount() external view returns (uint256) {
        return invoiceIds.length;
    }

    function getInvoiceIdAt(uint256 index) external view returns (string memory) {
        require(index < invoiceIds.length, "TrustPay: index out of bounds");
        return invoiceIds[index];
    }

    function isAllowlisted(address wallet) external view returns (bool) {
        return allowlist[wallet];
    }

    function isBlacklisted(address wallet) external view returns (bool) {
        return blacklist[wallet];
    }
}
